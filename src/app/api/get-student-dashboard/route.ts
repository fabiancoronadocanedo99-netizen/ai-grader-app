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

    const { data: studentData, error: studentError } = await supabaseAdmin
      .from('students')
      .select(`*, classes ( name, user_id ), grades ( id, score_obtained, score_possible, ai_feedback, created_at, exams ( name, type ) )`)
      .eq('id', studentId)
      .single()

    if (studentError || !studentData) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Lógica FODA
    let finalSwot = studentData.ai_swot
    if (!finalSwot) {
      const lastGrade = studentData.grades?.filter((g: any) => g.ai_feedback).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      const smallCtx = lastGrade?.ai_feedback?.informe_evaluacion?.evaluacion_detallada?.[0]?.feedback || "Buen progreso."
      finalSwot = await generateSWOT(smallCtx.substring(0, 200))
      if (finalSwot) await supabaseAdmin.from('students').update({ ai_swot: finalSwot, swot_last_updated: new Date().toISOString() }).eq('id', studentId)
    }

    // Asegurar objeto FODA para que el front no explote
    const safeSwot = finalSwot || { fortalezas: "En proceso", oportunidades: "En proceso", debilidades: "En proceso", amenazas: "En proceso" }

    return NextResponse.json({
      success: true,
      student: { id: studentData.id, fullName: studentData.full_name, studentEmail: studentData.student_email, tutorEmail: studentData.tutor_email },
      class: { name: studentData.classes?.name || 'Sin clase' },
      grades: (studentData.grades || []).map((g: any) => ({
        id: g.id, examName: g.exams?.name || 'Evaluación', type: g.exams?.type || 'exam',
        scoreObtained: g.score_obtained, scorePossible: g.score_possible,
        percentage: g.score_possible ? Math.round((g.score_obtained / g.score_possible) * 100) : 0,
        createdAt: g.created_at
      })),
      stats: {
        totalEvaluations: studentData.grades?.length || 0,
        averageScore: calculateAverage(studentData.grades || []),
        totalPoints: calculatePoints(studentData.grades || []),
        monthlyAverages: calculateMonthly(studentData.grades || [])
      },
      ai_swot: safeSwot
    })
  } catch (e) { return NextResponse.json({ error: 'Server Error' }, { status: 500 }) }
}

async function generateSWOT(ctx: string) {
  try {
    const key = process.env.GOOGLE_AI_API_KEY;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: `Alumno feedback: "${ctx}". Genera JSON con: fortalezas, oportunidades, debilidades, amenazas. Sé muy breve. SOLO JSON.` }] }] })
    })
    const data = await res.json()
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const match = rawText.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0])
    const norm: any = {}
    Object.keys(parsed).forEach(k => norm[k.toLowerCase()] = parsed[k])
    return norm
  } catch { return null }
}

function calculateAverage(gs: any[]) {
  const v = gs.filter(g => g.score_obtained !== null && g.score_possible)
  return v.length ? Math.round(v.reduce((s, g) => s + ((g.score_obtained / g.score_possible) * 100), 0) / v.length) : 0
}

function calculatePoints(gs: any[]) {
  return { obtained: gs.reduce((s, g) => s + (g.score_obtained || 0), 0), possible: gs.reduce((s, g) => s + (g.score_possible || 0), 0) }
}

function calculateMonthly(gs: any[]) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const stats = Array.from({ length: 12 }, (_, i) => ({ month: months[i], sum: 0, count: 0 }))
  gs.forEach(g => {
    const d = new Date(g.created_at)
    if (d.getFullYear() === new Date().getFullYear() && g.score_possible) {
      const idx = d.getMonth(); stats[idx].sum += (g.score_obtained / g.score_possible) * 100; stats[idx].count++
    }
  })
  return stats.map(m => ({ month: m.month, average: m.count > 0 ? Math.round(m.sum / m.count) : null }))
}