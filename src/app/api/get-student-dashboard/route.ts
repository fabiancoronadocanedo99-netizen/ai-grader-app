// src/app/api/get-student-dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.replace('Bearer ', '')
    if (!accessToken) return NextResponse.json({ error: 'Token requerido' }, { status: 401 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { studentId } = await request.json()
    const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data: studentData, error: studentError } = await supabaseAdmin
      .from('students')
      .select(`*, classes ( name, user_id ), grades ( id, score_obtained, score_possible, ai_feedback, created_at, exams ( name, type ) )`)
      .eq('id', studentId)
      .single()

    if (studentError || !studentData) return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 })

    let finalSwot = studentData.ai_swot
    const lastUpdate = studentData.swot_last_updated ? new Date(studentData.swot_last_updated) : null
    const daysSince = lastUpdate ? (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24) : 999

    if (!finalSwot || daysSince > 15) {
      console.log("🚩 [LOG] Generando diagnóstico para:", studentData.full_name);

      // EXTRACCIÓN SÚPER RESUMIDA (Para no disparar filtros de seguridad de Google)
      const feedbackTexts = studentData.grades
        .filter((g: any) => g.ai_feedback)
        .slice(0, 3) 
        .map((g: any) => {
          const f = g.ai_feedback;
          // Sacamos solo una frase clave para que Google no se asuste
          if (f.informe_evaluacion?.resumen_general?.comentarios_globales) {
              return f.informe_evaluacion.resumen_general.comentarios_globales.substring(0, 200);
          }
          return "Buen desempeño en las evaluaciones realizadas.";
        });

      if (feedbackTexts.length > 0) {
        const swotResult = await generateSWOT(feedbackTexts);
        if (swotResult) {
          finalSwot = swotResult;
          await supabaseAdmin.from('students').update({ 
            ai_swot: finalSwot, 
            swot_last_updated: new Date().toISOString() 
          }).eq('id', studentId);
          console.log("✅ [ÉXITO] FODA guardado.");
        }
      }
    }

    // Fallback amigable
    if (!finalSwot) {
      finalSwot = {
        fortalezas: "Análisis pedagógico en proceso.",
        oportunidades: "Se requiere más historial para diagnóstico detallado.",
        debilidades: "Información insuficiente actualmente.",
        amenazas: "Mantener regularidad en las entregas."
      };
    }

    return NextResponse.json({
      success: true,
      student: { id: studentData.id, fullName: studentData.full_name, studentEmail: studentData.student_email, tutorEmail: studentData.tutor_email },
      class: { name: studentData.classes?.name },
      grades: studentData.grades.map((g: any) => ({
        id: g.id, examName: g.exams?.name || 'Evaluación', type: g.exams?.type || 'exam',
        scoreObtained: g.score_obtained, scorePossible: g.score_possible,
        percentage: g.score_possible ? Math.round((g.score_obtained / g.score_possible) * 100) : 0,
        createdAt: g.created_at
      })),
      stats: {
        totalEvaluations: studentData.grades.length,
        averageScore: calculateAverage(studentData.grades),
        totalPoints: calculatePoints(studentData.grades),
        monthlyAverages: calculateMonthly(studentData.grades)
      },
      ai_swot: finalSwot
    })

  } catch (error) {
    console.error("❌ [CRITICAL]:", error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

async function generateSWOT(feedbacks: string[]) {
  try {
    const GEMINI_KEY = process.env.GOOGLE_AI_API_KEY;
    if (!GEMINI_KEY) return null;

    // Prompt minimalista para evitar bloqueos
    const prompt = `Basado en: "${feedbacks.join('. ')}". 
    Genera un JSON con fortalezas, oportunidades, debilidades y amenazas. 
    Máximo 10 palabras por punto. SOLO JSON PURO.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // DESACTIVAMOS TODOS LOS FILTROS PARA QUE NO DEVUELVA VACÍO
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: {
            temperature: 0.1, // Baja temperatura para que sea más preciso y rápido
            topP: 0.1
        }
      })
    });

    const data = await res.json();

    // Si Google nos da error de seguridad, lo veremos aquí
    if (data.promptFeedback?.blockReason) {
        console.error("❌ [GOOGLE BLOCKED]:", data.promptFeedback.blockReason);
        return null;
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!rawText) return null;

    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    const jsonString = rawText.substring(start, end + 1);

    const parsed = JSON.parse(jsonString);
    const normalized: any = {};
    Object.keys(parsed).forEach(key => {
      normalized[key.toLowerCase()] = parsed[key];
    });

    return normalized;
  } catch (e) {
    console.error("❌ [GENERATE SWOT ERROR]:", e);
    return null;
  }
}

function calculateAverage(grades: any[]) {
  const v = grades.filter((g: any) => g.score_obtained !== null && g.score_possible);
  return v.length ? Math.round(v.reduce((s: number, g: any) => s + ((g.score_obtained / g.score_possible) * 100), 0) / v.length) : 0;
}

function calculatePoints(grades: any[]) {
  return { obtained: grades.reduce((s: number, g: any) => s + (g.score_obtained || 0), 0), possible: grades.reduce((s: number, g: any) => s + (g.score_possible || 0), 0) }
}

function calculateMonthly(grades: any[]) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const stats = Array.from({ length: 12 }, (_, i) => ({ month: months[i], sum: 0, count: 0 }));
  const currentYear = new Date().getFullYear();
  grades.forEach((g: any) => {
    const d = new Date(g.created_at);
    if (d.getFullYear() === currentYear && g.score_possible) {
      const idx = d.getMonth();
      stats[idx].sum += (g.score_obtained / g.score_possible) * 100;
      stats[idx].count++;
    }
  });
  return stats.map((m: any) => ({ month: m.month, average: m.count > 0 ? Math.round(m.sum / m.count) : null }));
}