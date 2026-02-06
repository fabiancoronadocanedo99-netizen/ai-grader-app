  import { NextRequest, NextResponse } from 'next/server'
  import { createClient } from '@supabase/supabase-js'

  export const dynamic = 'force-dynamic'

  export async function POST(request: NextRequest) {
    try {
      const authHeader = request.headers.get('authorization')
      const accessToken = authHeader?.replace('Bearer ', '')
      if (!accessToken) return NextResponse.json({ error: 'No token' }, { status: 401 })

      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const { studentId } = await request.json()
      const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

      // --- MEJORA: Se añade 'subject' y 'id' en el select de exams ---
      const { data: studentData, error: studentError } = await supabaseAdmin
        .from('students')
        .select(`
          *, 
          classes ( name ), 
          grades ( 
            score_obtained, 
            score_possible, 
            ai_feedback, 
            created_at, 
            exams ( id, name, type, subject ) 
          )
        `)
        .eq('id', studentId)
        .single()

      if (studentError || !studentData) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      // --- LÓGICA DE INSIGHTS PEDAGÓGICOS ---
      const allEvaluations = studentData.grades || []
      const masteredTopics = new Set<string>()
      const reviewTopics = new Set<string>()
      let lastRecommendation = "Continúa con el plan de estudios estándar."

      allEvaluations.forEach((g: any) => {
        const detail = g.ai_feedback?.informe_evaluacion?.evaluacion_detallada || []
        detail.forEach((item: any) => {
          if (item.evaluacion === 'CORRECTO') masteredTopics.add(item.tema)
          if (item.evaluacion === 'INCORRECTO' || item.evaluacion === 'PARCIAL') reviewTopics.add(item.tema)
        })
      })

      const latestGrade = [...allEvaluations].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      if (latestGrade?.ai_feedback?.informe_evaluacion?.evaluacion_detallada) {
          const primaryIssue = latestGrade.ai_feedback.informe_evaluacion.evaluacion_detallada.find((i:any) => i.area_de_mejora)
          if (primaryIssue) lastRecommendation = primaryIssue.area_de_mejora
      }

      return NextResponse.json({
        success: true,
        student: { id: studentData.id, fullName: studentData.full_name, studentEmail: studentData.student_email, tutorEmail: studentData.tutor_email },
        class: { name: studentData.classes?.name || 'Sin Clase' },

        // --- SECCIÓN ACTUALIZADA ---
        grades: allEvaluations.map((g: any) => ({
          examId: g.exams?.id,
          examName: g.exams?.name || 'Evaluación',
          type: g.exams?.type || 'exam',
          // Como ya borraste la otra, solo pedimos 'subject'
          subject: g.exams?.subject || 'General', 
          percentage: g.score_possible ? Math.round((g.score_obtained / g.score_possible) * 100) : 0,
          pointsObtained: g.score_obtained,
          pointsPossible: g.score_possible,
          createdAt: g.created_at
        })),
        // ---------------------------

        stats: {
          totalEvaluations: allEvaluations.length,
          totalPoints: {
            obtained: allEvaluations.reduce((acc: number, curr: any) => acc + (curr.score_obtained || 0), 0),
            possible: allEvaluations.reduce((acc: number, curr: any) => acc + (curr.score_possible || 0), 0)
          },
          monthlyAverages: calculateMonthly(allEvaluations)
        },
        pedagogicalInsights: {
          mastered: Array.from(masteredTopics).slice(0, 4),
          toReview: Array.from(reviewTopics).slice(0, 4),
          recommendation: lastRecommendation
        },
        ai_swot: {
          fortalezas: Array.from(masteredTopics).slice(0, 2).join(", ") || "En análisis",
          oportunidades: lastRecommendation.substring(0, 100),
          debilidades: Array.from(reviewTopics).slice(0, 2).join(", ") || "Ninguna detectada",
          amenazas: "Mantener el ritmo de entrega"
        }
      })
    } catch (e) { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
  }

  function calculateMonthly(gs: any[]) {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const stats = Array.from({ length: 12 }, (_, i) => ({ month: months[i], sum: 0, count: 0 }));

    let targetYear = new Date().getFullYear();
    const hasDataThisYear = gs.some(g => new Date(g.created_at).getFullYear() === targetYear);
    if (!hasDataThisYear) {
        targetYear = targetYear - 1;
    }

    gs.forEach(g => {
      const d = new Date(g.created_at);
      if (d.getFullYear() === targetYear && g.score_possible) {
        const idx = d.getMonth();
        stats[idx].sum += (g.score_obtained / g.score_possible) * 100;
        stats[idx].count++;
      }
    });

    return stats.map(m => ({ 
      month: m.month, 
      average: m.count > 0 ? Math.round(m.sum / m.count) : null 
    }));
  }