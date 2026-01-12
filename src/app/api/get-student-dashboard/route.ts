// src/app/api/get-student-dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
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

    let finalSwot = studentData.ai_swot
    const lastUpdate = studentData.swot_last_updated ? new Date(studentData.swot_last_updated) : null
    const daysSince = lastUpdate ? (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24) : 999

    if (!finalSwot || daysSince > 15) {
      console.log("🚩 [PASO 1] Iniciando generación para:", studentData.full_name);

      const feedbackTexts = studentData.grades
        .filter((g: any) => g.ai_feedback)
        .slice(0, 10) 
        .map((g: any) => JSON.stringify(g.ai_feedback));

      console.log("🚩 [PASO 2] Cantidad de feedbacks encontrados:", feedbackTexts.length);

      if (feedbackTexts.length > 0) {
        const swotResult = await generateSWOT(feedbackTexts);

        if (swotResult) {
          console.log("🚩 [PASO 4] IA respondió con éxito. Intentando guardar en DB...");
          finalSwot = swotResult;

          const { error: dbError } = await supabaseAdmin
            .from('students')
            .update({ 
              ai_swot: finalSwot, 
              swot_last_updated: new Date().toISOString() 
            })
            .eq('id', studentId);

          if (dbError) {
            console.error("❌ [ERROR DB] No se pudo actualizar el estudiante:", dbError);
          } else {
            console.log("✅ [ÉXITO] Base de datos actualizada correctamente");
          }
        } else {
          console.error("❌ [ERROR IA] La función generateSWOT no devolvió nada.");
        }
      }
    }

    if (!finalSwot) {
      finalSwot = {
        fortalezas: "Análisis en proceso. Se requiere más historial.",
        oportunidades: "Completar evaluaciones pendientes.",
        debilidades: "Datos insuficientes para diagnóstico.",
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
    console.error("❌ [ERROR CRÍTICO]:", error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

async function generateSWOT(feedbacks: string[]) {
  try {
    const GEMINI_KEY = process.env.GOOGLE_AI_API_KEY;
    if (!GEMINI_KEY) {
      console.error("❌ [CONFIG] No existe GOOGLE_AI_API_KEY");
      return null;
    }

    console.log("🚩 [PASO 3] Llamando a Google Gemini...");

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Eres un pedagogo experto. Analiza este historial: ${feedbacks.join('\n')}. 
            Genera un JSON con: fortalezas, oportunidades, debilidades, amenazas. 
            Responde SOLO el JSON puro, sin markdown ni explicaciones.`
          }]
        }]
      })
    });

    const data = await res.json();

    // Log para ver qué dice Google exactamente
    console.log("🚩 [RESPUESTA RAW GOOGLE]:", JSON.stringify(data));

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
    console.error("❌ [FALLO generateSWOT]:", e);
    return null;
  }
}

function calculateAverage(grades: any[]) {
  const v = grades.filter(g => g.score_obtained !== null && g.score_possible);
  return v.length ? Math.round(v.reduce((s, g) => s + ((g.score_obtained / g.score_possible) * 100), 0) / v.length) : 0;
}

function calculatePoints(grades: any[]) {
  return { obtained: grades.reduce((s, g) => s + (g.score_obtained || 0), 0), possible: grades.reduce((s, g) => s + (g.score_possible || 0), 0) }
}

function calculateMonthly(grades: any[]) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const stats = Array.from({ length: 12 }, (_, i) => ({ month: months[i], sum: 0, count: 0 }));
  const currentYear = new Date().getFullYear();
  grades.forEach(g => {
    const d = new Date(g.created_at);
    if (d.getFullYear() === currentYear && g.score_possible) {
      const idx = d.getMonth();
      stats[idx].sum += (g.score_obtained / g.score_possible) * 100;
      stats[idx].count++;
    }
  });
  return stats.map(m => ({ month: m.month, average: m.count > 0 ? Math.round(m.sum / m.count) : null }));
}