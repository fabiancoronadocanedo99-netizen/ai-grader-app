// src/app/api/get-student-dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.replace('Bearer ', '')
    if (!accessToken) return NextResponse.json({ error: 'Token requerido' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // 2. Obtener datos del estudiante
    const { studentId } = await request.json()
    const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data: studentData, error: studentError } = await supabaseAdmin
      .from('students')
      .select(`
        *,
        classes ( name, user_id ),
        grades ( 
          id, score_obtained, score_possible, ai_feedback, created_at,
          exams ( name, type )
        )
      `)
      .eq('id', studentId)
      .single()

    if (studentError || !studentData) return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 })

    // Verificación de seguridad
    if (studentData.classes.user_id !== user.id) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    // --- 3. LÓGICA DE GENERACIÓN FODA IA (OPTIMIZADA PARA VERCEL) ---
    let finalSwot = studentData.ai_swot
    const lastUpdate = studentData.swot_last_updated ? new Date(studentData.swot_last_updated) : null
    const daysSince = lastUpdate ? (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24) : 999

    if (!finalSwot || daysSince > 15) {
      console.log("🚩 [INICIO] Generando FODA para:", studentData.full_name);

      // Extraemos feedbacks (Máximo 3 para velocidad)
      const feedbackTexts = studentData.grades
        .filter((g: any) => g.ai_feedback)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3) 
        .map((g: any) => {
          const f = g.ai_feedback;
          let text = "";
          if (f.informe_evaluacion?.evaluacion_detallada) {
            text = f.informe_evaluacion.evaluacion_detallada.map((ed: any) => ed.feedback).join(". ");
          } else {
            text = JSON.stringify(f);
          }
          return text.substring(0, 500); 
        });

      if (feedbackTexts.length > 0) {
        const swotResult = await generateSWOT(feedbackTexts);
        if (swotResult) {
          finalSwot = swotResult;
          await supabaseAdmin.from('students')
            .update({ ai_swot: finalSwot, swot_last_updated: new Date().toISOString() })
            .eq('id', studentId);
        }
      }
    }

    // Fallback por si no hay datos o la IA falla
    if (!finalSwot) {
      finalSwot = {
        fortalezas: "Análisis en proceso. Se requiere más historial.",
        oportunidades: "Completar evaluaciones pendientes.",
        debilidades: "Datos insuficientes para diagnóstico.",
        amenazas: "Mantener regularidad en las entregas."
      };
    }

    // 4. Devolver respuesta
    return NextResponse.json({
      success: true,
      student: {
        id: studentData.id,
        fullName: studentData.full_name,
        studentEmail: studentData.student_email,
        tutorEmail: studentData.tutor_email,
      },
      class: { name: studentData.classes.name },
      grades: studentData.grades.map((g: any) => ({
        id: g.id,
        examName: g.exams?.name || 'Evaluación',
        type: g.exams?.type || 'exam',
        scoreObtained: g.score_obtained,
        scorePossible: g.score_possible,
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
    console.error("❌ Error API Dashboard:", error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// --- FUNCIÓN GEMINI CON SAFETY SETTINGS ---
async function generateSWOT(feedbacks: string[]) {
  try {
    const GEMINI_KEY = process.env.GOOGLE_AI_API_KEY;
    if (!GEMINI_KEY) return null;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Eres un experto pedagogo. Analiza estos informes: ${feedbacks.join('\n')}. 
            Genera un JSON con: fortalezas, oportunidades, debilidades, amenazas. 
            Responde SOLO el JSON puro, sin markdown ni explicaciones.`
          }]
        }],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      })
    });

    const data = await res.json();
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
    return null;
  }
}

// --- FUNCIONES AUXILIARES CON TIPADO CORRECTO ---

function calculateAverage(grades: any[]) {
  const v = grades.filter((g: any) => g.score_obtained !== null && g.score_possible);
  if (v.length === 0) return 0;
  return Math.round(v.reduce((s: number, g: any) => s + ((g.score_obtained / g.score_possible) * 100), 0) / v.length);
}

function calculatePoints(grades: any[]) {
  return {
    obtained: grades.reduce((s: number, g: any) => s + (g.score_obtained || 0), 0),
    possible: grades.reduce((s: number, g: any) => s + (g.score_possible || 0), 0)
  }
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