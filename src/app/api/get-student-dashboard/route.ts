// src/app/api/get-student-dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Tipos para la respuesta estructurada
type StudentDashboardData = {
  id: string
  full_name: string
  student_email: string | null
  tutor_email: string | null
  class_id: string
  user_id: string
  created_at: string
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
    } | null
  }>
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.replace('Bearer ', '')

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Token de autenticación requerido' },
        { status: 401 }
      )
    }

    // Verificar que el token sea válido y obtener el usuario
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Autenticación fallida' },
        { status: 401 }
      )
    }

    console.log('✅ Usuario autenticado:', user.id)

    // 2. Obtener studentId del cuerpo de la petición
    const body = await request.json()
    const { studentId } = body

    if (!studentId || typeof studentId !== 'string') {
      return NextResponse.json(
        { error: 'studentId es requerido y debe ser un string' },
        { status: 400 }
      )
    }

    console.log('🔍 Buscando información para student:', studentId)

    // 3. Crear cliente admin de Supabase
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 4. Realizar la consulta completa en una sola llamada
    const { data: studentData, error: studentError } = await supabaseAdmin
      .from('students')
      .select(`
        *,
        classes ( name, user_id ),
        grades ( 
          id,
          student_id,
          exam_id,
          score_obtained,
          score_possible,
          ai_feedback,
          created_at,
          exams ( name )
        )
      `)
      .eq('id', studentId)
      .single<StudentDashboardData>()

    if (studentError) {
      console.error('❌ Error al buscar estudiante:', studentError)

      if (studentError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Estudiante no encontrado' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { error: 'Error al obtener datos del estudiante', details: studentError.message },
        { status: 500 }
      )
    }

    if (!studentData) {
      return NextResponse.json(
        { error: 'Estudiante no encontrado' },
        { status: 404 }
      )
    }

    console.log('📊 Datos encontrados:', {
      student: studentData.full_name,
      class: studentData.classes?.name,
      grades: studentData.grades?.length || 0
    })

    // 5. Verificación de seguridad: El usuario debe ser dueño de la clase
    if (!studentData.classes) {
      return NextResponse.json(
        { error: 'El estudiante no está asociado a ninguna clase' },
        { status: 404 }
      )
    }

    if (studentData.classes.user_id !== user.id) {
      console.warn('⚠️ Intento de acceso no autorizado:', {
        requestedBy: user.id,
        classOwner: studentData.classes.user_id
      })

      return NextResponse.json(
        { error: 'Acceso denegado: No tienes permiso para ver este estudiante' },
        { status: 403 }
      )
    }

    console.log('✅ Verificación de seguridad pasada')

    // 6. Preparar y devolver los datos
    const response = {
      success: true,
      student: {
        id: studentData.id,
        fullName: studentData.full_name,
        studentEmail: studentData.student_email,
        tutorEmail: studentData.tutor_email,
        classId: studentData.class_id,
        createdAt: studentData.created_at
      },
      class: {
        name: studentData.classes.name
      },
      grades: studentData.grades.map(grade => ({
        id: grade.id,
        examId: grade.exam_id,
        examName: grade.exams?.name || 'Sin nombre',
        scoreObtained: grade.score_obtained,
        scorePossible: grade.score_possible,
        percentage: grade.score_possible && grade.score_obtained 
          ? Math.round((grade.score_obtained / grade.score_possible) * 100)
          : 0,
        aiFeedback: grade.ai_feedback,
        createdAt: grade.created_at
      })),
      stats: {
        totalExams: studentData.grades?.length || 0,
        averageScore: calculateAverageScore(studentData.grades),
        totalPoints: calculateTotalPoints(studentData.grades)
      }
    }

    console.log('✅ Dashboard generado exitosamente')

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error fatal en la API:', error)
    return NextResponse.json(
      { 
        error: 'Error interno del servidor', 
        details: (error as Error).message 
      },
      { status: 500 }
    )
  }
}

// Funciones auxiliares para calcular estadísticas
function calculateAverageScore(grades: StudentDashboardData['grades']): number {
  if (!grades || grades.length === 0) return 0

  const validGrades = grades.filter(g => 
    g.score_obtained !== null && 
    g.score_possible !== null && 
    g.score_possible > 0
  )

  if (validGrades.length === 0) return 0

  const totalPercentage = validGrades.reduce((sum, grade) => {
    const percentage = (grade.score_obtained! / grade.score_possible!) * 100
    return sum + percentage
  }, 0)

  return Math.round(totalPercentage / validGrades.length)
}

function calculateTotalPoints(grades: StudentDashboardData['grades']): {
  obtained: number
  possible: number
} {
  if (!grades || grades.length === 0) {
    return { obtained: 0, possible: 0 }
  }

  const validGrades = grades.filter(g => 
    g.score_obtained !== null && 
    g.score_possible !== null
  )

  const obtained = validGrades.reduce((sum, grade) => sum + grade.score_obtained!, 0)
  const possible = validGrades.reduce((sum, grade) => sum + grade.score_possible!, 0)

  return { obtained, possible }
}