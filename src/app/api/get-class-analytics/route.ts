// src/app/api/get-class-analytics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// --- TIPOS ---
interface GradeDistribution {
  range: string
  count: number
  percentage: number
}

interface QuestionError {
  questionId: string
  tema: string | null
  errorCount: number
  percentage: number
}

interface ErrorTypeCount {
  name: string  // Recharts espera 'name'
  value: number // Recharts espera 'value'
  percentage: number
}

interface ClassAnalytics {
  success: boolean
  classInfo: {
    id: string
    name: string
    totalStudents: number
    totalGrades: number
  }
  generalStats: {
    classAverage: number
    highestScore: number
    lowestScore: number
    passingRate: number // Porcentaje de aprobados (>=60%)
  }
  gradeDistribution: GradeDistribution[]
  topFailedQuestions: QuestionError[]
  errorTypesFrequency: ErrorTypeCount[]
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

    // Verificar usuario
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

    // 2. Obtener classId del body
    const body = await request.json()
    const { classId } = body

    if (!classId || typeof classId !== 'string') {
      return NextResponse.json(
        { error: 'classId es requerido y debe ser un string' },
        { status: 400 }
      )
    }

    console.log('🔍 Analizando clase:', classId)

    // 3. Crear cliente admin
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verificar que el usuario es dueño de la clase
    const { data: classData, error: classError } = await supabaseAdmin
      .from('classes')
      .select('id, name, user_id')
      .eq('id', classId)
      .single()

    if (classError || !classData) {
      console.error('❌ Error al buscar clase:', classError)
      return NextResponse.json(
        { error: 'Clase no encontrada' },
        { status: 404 }
      )
    }

    // Validar permisos
    if (classData.user_id !== user.id) {
      console.warn('⚠️ Intento de acceso no autorizado:', {
        requestedBy: user.id,
        classOwner: classData.user_id
      })

      return NextResponse.json(
        { error: 'Acceso denegado: No tienes permiso para ver esta clase' },
        { status: 403 }
      )
    }

    console.log('✅ Permisos verificados para clase:', classData.name)

    // 4. Obtener TODAS las calificaciones de la clase con información relacionada
    const { data: grades, error: gradesError } = await supabaseAdmin
      .from('grades')
      .select(`
        id,
        student_id,
        exam_id,
        score_obtained,
        score_possible,
        ai_feedback,
        exams!inner (
          class_id,
          name
        )
      `)
      .eq('exams.class_id', classId)

    if (gradesError) {
      console.error('❌ Error al obtener calificaciones:', gradesError)
      return NextResponse.json(
        { error: 'Error al obtener calificaciones', details: gradesError.message },
        { status: 500 }
      )
    }

    console.log(`📊 Calificaciones encontradas: ${grades?.length || 0}`)

    // Contar estudiantes únicos
    const uniqueStudents = new Set(grades?.map(g => g.student_id) || []).size

    // 5. Procesar datos y calcular estadísticas

    // --- ESTADÍSTICAS GENERALES ---
    const validGrades = grades?.filter(g => 
      g.score_obtained !== null && 
      g.score_possible !== null && 
      g.score_possible > 0
    ) || []

    if (validGrades.length === 0) {
      return NextResponse.json({
        success: true,
        classInfo: {
          id: classData.id,
          name: classData.name,
          totalStudents: uniqueStudents,
          totalGrades: 0
        },
        generalStats: {
          classAverage: 0,
          highestScore: 0,
          lowestScore: 0,
          passingRate: 0
        },
        gradeDistribution: [],
        topFailedQuestions: [],
        errorTypesFrequency: []
      })
    }

    // Calcular porcentajes
    const percentages = validGrades.map(g => 
      Math.round((g.score_obtained! / g.score_possible!) * 100)
    )

    const classAverage = Math.round(
      percentages.reduce((sum, p) => sum + p, 0) / percentages.length
    )

    const highestScore = Math.max(...percentages)
    const lowestScore = Math.min(...percentages)

    const passingGrades = percentages.filter(p => p >= 60).length
    const passingRate = Math.round((passingGrades / percentages.length) * 100)

    // --- DISTRIBUCIÓN DE CALIFICACIONES ---
    const distributionRanges = [
      { range: '90-100', min: 90, max: 100 },
      { range: '80-89', min: 80, max: 89 },
      { range: '70-79', min: 70, max: 79 },
      { range: '60-69', min: 60, max: 69 },
      { range: '0-59', min: 0, max: 59 }
    ]

    const gradeDistribution: GradeDistribution[] = distributionRanges.map(({ range, min, max }) => {
      const count = percentages.filter(p => p >= min && p <= max).length
      return {
        range,
        count,
        percentage: Math.round((count / percentages.length) * 100)
      }
    })

    // --- PREGUNTAS MÁS FALLADAS ---
    const questionErrors: Map<string, { count: number; tema: string | null }> = new Map()

    validGrades.forEach(grade => {
      let feedback = grade.ai_feedback

      // Parsear si es string
      if (typeof feedback === 'string') {
        try {
          feedback = JSON.parse(feedback)
        } catch (e) {
          return
        }
      }

      const evaluaciones = feedback?.informe_evaluacion?.evaluacion_detallada || []

      evaluaciones.forEach((pregunta: any) => {
        if (pregunta.evaluacion === 'INCORRECTO') {
          const questionId = pregunta.pregunta_id || 'Pregunta sin ID'
          const tema = pregunta.tema || null

          if (questionErrors.has(questionId)) {
            questionErrors.get(questionId)!.count++
          } else {
            questionErrors.set(questionId, { count: 1, tema })
          }
        }
      })
    })

    // Ordenar y tomar top 3
    const topFailedQuestions: QuestionError[] = Array.from(questionErrors.entries())
      .map(([questionId, data]) => ({
        questionId,
        tema: data.tema,
        errorCount: data.count,
        percentage: Math.round((data.count / validGrades.length) * 100)
      }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 3)

    // --- TIPOS DE ERROR MÁS COMUNES ---
    const errorTypesMap: Map<string, number> = new Map()
    let totalErrors = 0

    validGrades.forEach(grade => {
      let feedback = grade.ai_feedback

      if (typeof feedback === 'string') {
        try {
          feedback = JSON.parse(feedback)
        } catch (e) {
          return
        }
      }

      const evaluaciones = feedback?.informe_evaluacion?.evaluacion_detallada || []

      evaluaciones.forEach((pregunta: any) => {
        if (pregunta.tipo_de_error && pregunta.tipo_de_error !== 'ninguno') {
          const errorType = pregunta.tipo_de_error
          errorTypesMap.set(errorType, (errorTypesMap.get(errorType) || 0) + 1)
          totalErrors++
        }
      })
    })

    const errorTypesFrequency: ErrorTypeCount[] = Array.from(errorTypesMap.entries())
      .map(([type, count]) => ({
        name: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // Recharts espera 'name'
        value: count, // Recharts espera 'value'
        percentage: totalErrors > 0 ? Math.round((count / totalErrors) * 100) : 0
      }))
      .sort((a, b) => b.value - a.value)

    // 6. Construir respuesta
    const analytics: ClassAnalytics = {
      success: true,
      classInfo: {
        id: classData.id,
        name: classData.name,
        totalStudents: uniqueStudents,
        totalGrades: validGrades.length
      },
      generalStats: {
        classAverage,
        highestScore,
        lowestScore,
        passingRate
      },
      gradeDistribution,
      topFailedQuestions,
      errorTypesFrequency
    }

    console.log('✅ Analíticas generadas exitosamente')

    return NextResponse.json(analytics)

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