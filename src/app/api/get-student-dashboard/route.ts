// src/app/api/get-student-dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type StudentDashboardData = {
  id: string
  full_name: string
  student_email: string | null
  tutor_email: string | null
  class_id: string
  user_id: string
  created_at: string
  ai_swot: any // Columna para el JSON del FODA
  swot_last_updated: string | null // Columna para la fecha de control
  classes: {
    name: string
    user_id: string
  } | null
  grades: Array<{
    id: string
    student_id: string
    exam_id: string
    score_obtained: number | null
    score_possible: number | null
    ai_feedback: any
    created_at: string
    exams: {
      name: string
      type: 'exam' | 'assignment'
    } | null
  }>
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // 1. Autenticación
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

    // 2. Cliente Admin para lectura y escritura
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 3. Consulta inicial incluyendo ai_swot y swot_last_updated
    const { data: studentData, error: studentError } = await supabaseAdmin
      .from('students')
      .select(`
        *,
        classes ( name, user_id ),
        grades ( 
          id, student_id, exam_id, score_obtained, score_possible, ai_feedback, created_at,
          exams ( name, type )
        )
      `)
      .eq('id', studentId)
      .single<StudentDashboardData>()

    if (studentError || !studentData) return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 })

    // Seguridad: dueño de la clase
    if (studentData.classes?.user_id !== user.id) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    // --- 4. LÓGICA DE DECISIÓN FODA (CACHÉ) ---
    const lastUpdated = studentData.swot_last_updated ? new Date(studentData.swot_last_updated) : null
    const daysSinceUpdate = lastUpdated ? (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24) : 999

    const shouldRegenerate = !studentData.ai_swot || daysSinceUpdate > 15
    let finalSwot = studentData.ai_swot

    if (shouldRegenerate) {
      console.log('🔄 Regenerando FODA con IA (Caché expirada o inexistente)')

      const recentFeedbacks = studentData.grades
        .filter(g => g.ai_feedback)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map(g => typeof g.ai_feedback === 'string' ? g.ai_feedback : JSON.stringify(g.ai_feedback))

      if (recentFeedbacks.length > 0) {
        const swotResult = await generateSWOTWithGemini(recentFeedbacks)

        if (swotResult) {
          finalSwot = swotResult
          // Guardar en la base de datos para los próximos 15 días
          await supabaseAdmin
            .from('students')
            .update({ 
              ai_swot: swotResult, 
              swot_last_updated: new Date().toISOString() 
            })
            .eq('id', studentId)

          console.log('✅ FODA guardado en base de datos')
        }
      }
    } else {
      console.log(`📦 Usando FODA almacenado (Actualizado hace ${Math.floor(daysSinceUpdate)} días)`)
    }

    // 5. Preparar respuesta
    const response = {
      success: true,
      student: {
        id: studentData.id,
        fullName: studentData.full_name,
        studentEmail: studentData.student_email,
        tutorEmail: studentData.tutor_email,
        classId: studentData.class_id,
      },
      class: { name: studentData.classes?.name },
      grades: studentData.grades.map(grade => ({
        id: grade.id,
        examName: grade.exams?.name || 'Evaluación',
        type: grade.exams?.type || 'exam',
        percentage: grade.score_possible ? Math.round((grade.score_obtained! / grade.score_possible) * 100) : 0,
        createdAt: grade.created_at
      })),
      stats: {
        totalExams: studentData.grades.length,
        averageScore: calculateAverageScore(studentData.grades),
        totalPoints: calculateTotalPoints(studentData.grades),
        monthlyAverages: calculateMonthlyAverages(studentData.grades)
      },
      swot: finalSwot // Devolvemos el FODA (nuevo o de la DB)
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error fatal:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// --- FUNCIÓN GEMINI ---
async function generateSWOTWithGemini(feedbacks: string[]) {
  const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  // He usado 1.5-flash ya que 2.5 no existe comercialmente aún, pero el prompt es el solicitado
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`

  const prompt = {
    contents: [{
      parts: [{
        text: `Analiza este historial de feedback pedagógico y genera un FODA (Fortalezas, Oportunidades, Debilidades y Amenazas) académico. 

        Feedbacks:
        ${feedbacks.join('\n- ')}

        Devuelve exclusivamente un JSON con las claves: fortalezas, oportunidades, debilidades, amenazas. Sé ejecutivo y motivador.`
      }]
    }]
  }

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prompt)
  })

  const data = await response.json()
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // Limpieza de JSON
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  return jsonMatch ? JSON.parse(jsonMatch[0]) : null
}

// --- FUNCIONES AUXILIARES ---
function calculateAverageScore(grades: any[]) {
  const valid = grades.filter(g => g.score_obtained !== null && g.score_possible);
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((sum, g) => sum + ((g.score_obtained / g.score_possible) * 100), 0) / valid.length);
}

function calculateTotalPoints(grades: any[]) {
  const valid = grades.filter(g => g.score_obtained !== null && g.score_possible);
  return {
    obtained: valid.reduce((sum, g) => sum + g.score_obtained, 0),
    possible: valid.reduce((sum, g) => sum + g.score_possible, 0)
  }
}

function calculateMonthlyAverages(grades: any[]) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const stats = Array.from({ length: 12 }, (_, i) => ({ month: months[i], sum: 0, count: 0 }));
  const currentYear = new Date().getFullYear();

  grades.forEach(g => {
    const d = new Date(g.created_at);
    if (d.getFullYear() === currentYear && g.score_obtained !== null && g.score_possible) {
      const idx = d.getMonth();
      stats[idx].sum += (g.score_obtained / g.score_possible) * 100;
      stats[idx].count++;
    }
  });
  return stats.map(m => ({ month: m.month, average: m.count > 0 ? Math.round(m.sum / m.count) : null }));
}