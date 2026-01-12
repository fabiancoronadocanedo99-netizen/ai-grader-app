// src/app/api/get-student-dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.replace('Bearer ', '')
    if (!accessToken) return NextResponse.json({ error: 'No token' }, { status: 401 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { studentId } = await request.json()
    const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // 1. Buscamos al estudiante y sus notas usando los nombres exactos de tus columnas
    const { data: studentData, error: studentError } = await supabaseAdmin
      .from('students')
      .select(`
        *,
        classes ( name, user_id ),
        grades ( 
          id, 
          score_obtained, 
          score_possible, 
          ai_feedback, 
          created_at,
          exams ( name, type )
        )
      `)
      .eq('id', studentId)
      .single()

    if (studentError || !studentData) return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 })

    // --- 2. LÓGICA DE GENERACIÓN FODA IA ---
    let finalSwot = studentData.ai_swot

    // Si no tiene FODA, lo generamos tomando solo el feedback más reciente (para que sea instantáneo)
    if (!finalSwot) {
      console.log("🤖 Generando FODA para:", studentData.full_name);

      const lastGradeWithFeedback = (studentData.grades || [])
        .filter((g: any) => g.ai_feedback)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      if (lastGradeWithFeedback) {
        // Extraemos solo el texto del informe para no saturar a Gemini
        const feedbackObj = lastGradeWithFeedback.ai_feedback?.informe_evaluacion || lastGradeWithFeedback.ai_feedback;
        const textToAnalyze = JSON.stringify(feedbackObj).substring(0, 800);

        const generated = await generateSWOT(textToAnalyze);

        if (generated) {
          finalSwot = generated;
          // Guardar en la DB para que no se repita la llamada
          await supabaseAdmin
            .from('students')
            .update({ ai_swot: generated, swot_last_updated: new Date().toISOString() })
            .eq('id', studentId);
        }
      }
    }

    // 3. Formatear las notas para el frontend (asegurando promedios reales)
    const formattedGrades = (studentData.grades || []).map((g: any) => ({
      id: g.id,
      examName: g.exams?.name || 'Evaluación',
      type: g.exams?.type || 'exam',
      scoreObtained: Number(g.score_obtained) || 0,
      scorePossible: Number(g.score_possible) || 0,
      percentage: g.score_possible ? Math.round((g.score_obtained / g.score_possible) * 100) : 0,
      createdAt: g.created_at
    }));

    // 4. Calcular estadísticas
    const totalObtained = formattedGrades.reduce((acc: number, curr: any) => acc + curr.scoreObtained, 0);
    const totalPossible = formattedGrades.reduce((acc: number, curr: any) => acc + curr.scorePossible, 0);

    return NextResponse.json({
      success: true,
      student: {
        id: studentData.id,
        fullName: studentData.full_name,
        studentEmail: studentData.student_email,
        tutorEmail: studentData.tutor_email
      },
      class: { name: studentData.classes?.name || 'Sin Clase' },
      grades: formattedGrades,
      stats: {
        totalEvaluations: formattedGrades.length,
        totalPoints: { obtained: totalObtained, possible: totalPossible },
        monthlyAverages: calculateMonthly(formattedGrades)
      },
      ai_swot: finalSwot || { fortalezas: "Sin datos", oportunidades: "Sin datos", debilidades: "Sin datos", amenazas: "Sin datos" }
    })

  } catch (error) {
    console.error("Error Crítico:", error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 })
  }
}

async function generateSWOT(context: string) {
  try {
    const key = process.env.GOOGLE_AI_API_KEY;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analiza este informe pedagógico y genera un análisis FODA breve (máximo 10 palabras por punto). 
            Contexto: ${context}
            Responde ÚNICAMENTE un objeto JSON con las llaves: fortalezas, oportunidades, debilidades, amenazas.`
          }]
        }],
        generationConfig: { temperature: 0.1 }
      })
    });

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    const normalized: any = {};
    Object.keys(parsed).forEach(k => normalized[k.toLowerCase()] = parsed[k]);
    return normalized;
  } catch (e) {
    return null;
  }
}

function calculateMonthly(gs: any[]) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const stats = Array.from({ length: 12 }, (_, i) => ({ month: months[i], sum: 0, count: 0 }));
  const currentYear = new Date().getFullYear();

  gs.forEach(g => {
    const d = new Date(g.createdAt);
    if (d.getFullYear() === currentYear && g.scorePossible) {
      const idx = d.getMonth();
      stats[idx].sum += (g.scoreObtained / g.scorePossible) * 100;
      stats[idx].count++;
    }
  });
  return stats.map(m => ({ month: m.month, average: m.count > 0 ? Math.round(m.sum / m.count) : null }));
}