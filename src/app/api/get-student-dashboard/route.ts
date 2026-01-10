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

    // Verificación de seguridad
    if (studentData.classes.user_id !== user.id) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    // Lógica de caché para FODA (15 días)
    const lastUpdated = studentData.swot_last_updated ? new Date(studentData.swot_last_updated) : null
    const daysSince = lastUpdated ? (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24) : 999

    let finalSwot = studentData.ai_swot
    if (!finalSwot || daysSince > 15) {
      const feedbacks = studentData.grades.filter((g:any) => g.ai_feedback).slice(0,5).map((g:any) => g.ai_feedback)
      if (feedbacks.length > 0) {
        finalSwot = await generateSWOT(feedbacks)
        await supabaseAdmin.from('students').update({ ai_swot: finalSwot, swot_last_updated: new Date().toISOString() }).eq('id', studentId)
      }
    }

    return NextResponse.json({
      success: true,
      student: {
        id: studentData.id,
        fullName: studentData.full_name,
        studentEmail: studentData.student_email,
        tutorEmail: studentData.tutor_email,
        classId: studentData.class_id,
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
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

async function generateSWOT(feedbacks: string[]) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: `Analiza este feedback y genera un JSON con claves: fortalezas, oportunidades, debilidades, amenazas: ${feedbacks.join('|')}` }] }] })
  })
  const data = await res.json()
  const match = data.candidates?.[0]?.content?.parts?.[0]?.text.match(/\{[\s\S]*\}/)
  return match ? JSON.parse(match[0]) : null
}

function calculateAverage(grades: any[]) {
  const valid = grades.filter(g => g.score_obtained !== null && g.score_possible);
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((s, g) => s + ((g.score_obtained / g.score_possible) * 100), 0) / valid.length);
}

function calculatePoints(grades: any[]) {
  return {
    obtained: grades.reduce((s, g) => s + (g.score_obtained || 0), 0),
    possible: grades.reduce((s, g) => s + (g.score_possible || 0), 0)
  }
}

function calculateMonthly(grades: any[]) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const stats = Array.from({ length: 12 }, (_, i) => ({ month: months[i], sum: 0, count: 0 }));
  grades.forEach(g => {
    const d = new Date(g.created_at);
    if (d.getFullYear() === new Date().getFullYear() && g.score_possible) {
      const idx = d.getMonth();
      stats[idx].sum += (g.score_obtained / g.score_possible) * 100;
      stats[idx].count++;
    }
  });
  return stats.map(m => ({ month: m.month, average: m.count > 0 ? Math.round(m.sum / m.count) : null }));
}