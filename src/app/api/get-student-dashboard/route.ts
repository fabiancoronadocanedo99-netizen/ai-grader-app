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

    // SI NO HAY SWOT, GENERAMOS UNO MINI
    if (!finalSwot || daysSince > 15) {
      console.log("🚀 [PASO 1] Iniciando IA para:", studentData.full_name);

      // EXTRAEMOS SOLO EL FEEDBACK DE LA PRIMERA PREGUNTA DEL ÚLTIMO EXAMEN (MÁXIMA VELOCIDAD)
      const lastGrade = studentData.grades
        .filter((g: any) => g.ai_feedback)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      let smallContext = "Buen progreso general.";
      if (lastGrade?.ai_feedback?.informe_evaluacion?.evaluacion_detallada?.[0]?.feedback) {
          smallContext = lastGrade.ai_feedback.informe_evaluacion.evaluacion_detallada[0].feedback;
      }

      const swotResult = await generateSWOT(smallContext.substring(0, 300));

      if (swotResult) {
        finalSwot = swotResult;
        console.log("🚀 [PASO 2] IA respondió. Guardando...");
        await supabaseAdmin.from('students').update({ 
          ai_swot: finalSwot, 
          swot_last_updated: new Date().toISOString() 
        }).eq('id', studentId);
      }
    }

    // Fallback si la IA falló
    if (!finalSwot) {
      finalSwot = {
        fortalezas: "Análisis en proceso.",
        oportunidades: "Completar más tareas.",
        debilidades: "Datos insuficientes.",
        amenazas: "Mantener constancia."
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
    console.error("❌ Error:", error)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

async function generateSWOT(context: string) {
  try {
    const GEMINI_KEY = process.env.GOOGLE_AI_API_KEY;
    if (!GEMINI_KEY) return null;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Alumno: "${context}". Genera JSON con claves: fortalezas, oportunidades, debilidades, amenazas. Sé breve (5 palabras c/u). SOLO JSON.` }] }],
        safetySettings: [{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }]
      })
    });

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!rawText) return null;

    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    const parsed = JSON.parse(rawText.substring(start, end + 1));

    const normalized: any = {};
    Object.keys(parsed).forEach(k => normalized[k.toLowerCase()] = parsed[k]);
    return normalized;
  } catch (e) {
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