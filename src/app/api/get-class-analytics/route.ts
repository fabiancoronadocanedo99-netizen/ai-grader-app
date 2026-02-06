// src/app/api/get-class-analytics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// --- TIPOS ---
interface StudentSummary {
  id: string
  name: string
}

interface ExamInfo {
  id: string
  name: string
  subject: string | null
  gradeCount: number
}

interface GradeDistribution {
  range: string
  count: number
  percentage: number
  students: StudentSummary[]
}

interface QuestionError {
  questionId: string
  tema: string | null
  errorCount: number
  percentage: number
  failingStudents: StudentSummary[]
}

interface ErrorTypeCount {
  name: string
  value: number
  percentage: number
  students: StudentSummary[] // <--- CORRECCIÓN: Añadida lista de estudiantes
}

interface ClassAnalytics {
  success: boolean
  classInfo: {
    id: string
    name: string
    totalStudents: number
    totalGrades: number
  }
  examsInfo: ExamInfo[]
  generalStats: {
    classAverage: number
    highestScore: number
    lowestScore: number
    passingRate: number
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

    // 2. Obtener parámetros del body
    const body = await request.json()
    const { classId, examId } = body 

    if (!classId || typeof classId !== 'string') {
      return NextResponse.json(
        { error: 'classId es requerido y debe ser un string' },
        { status: 400 }
      )
    }

    console.log(`🔍 Analizando clase: ${classId} ${examId ? `| Examen específico: ${examId}` : '| Toda la clase'}`)

    // 3. Crear cliente admin
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: classData, error: classError } = await supabaseAdmin
      .from('classes')
      .select('id, name, user_id')
      .eq('id', classId)
      .single()

    if (classError || !classData) {
      return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })
    }

    if (classData.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Acceso denegado' },
        { status: 403 }
      )
    }

    // 4. Construir la consulta de calificaciones
    let gradesQuery = supabaseAdmin
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
          name,
          subject
        ),
        students (
          id,
          full_name
        )
      `)
      .eq('exams.class_id', classId)

    if (examId) {
      gradesQuery = gradesQuery.eq('exam_id', examId)
    }

    const { data: grades, error: gradesError } = await gradesQuery

    if (gradesError) {
      console.error('❌ Error al obtener calificaciones:', gradesError)
      return NextResponse.json(
        { error: 'Error al obtener calificaciones', details: gradesError.message },
        { status: 500 }
      )
    }

    const uniqueStudents = new Set(grades?.map(g => g.student_id) || []).size

    // 5. Procesar datos
    const validGrades = grades?.filter(g => 
      g.score_obtained !== null && 
      g.score_possible !== null && 
      g.score_possible > 0
    ) || []

    // Helper para obtener nombre
    const getStudentName = (grade: any) => {
      const student = Array.isArray(grade.students) ? grade.students[0] : grade.students
      return student?.full_name || 'Estudiante Desconocido'
    }

    if (validGrades.length === 0) {
      return NextResponse.json({
        success: true,
        classInfo: {
          id: classData.id,
          name: classData.name,
          totalStudents: uniqueStudents,
          totalGrades: 0
        },
        examsInfo: [],
        generalStats: { classAverage: 0, highestScore: 0, lowestScore: 0, passingRate: 0 },
        gradeDistribution: [],
        topFailedQuestions: [],
        errorTypesFrequency: []
      })
    }

    // --- INFORMACIÓN DE EXÁMENES ---
    const examsMap = new Map<string, { name: string; subject: string | null; count: number }>()

    validGrades.forEach(grade => {
      const exam = Array.isArray(grade.exams) ? grade.exams[0] : grade.exams
      if (exam && exam.class_id) {
        const examId = grade.exam_id
        if (examsMap.has(examId)) {
          examsMap.get(examId)!.count++
        } else {
          examsMap.set(examId, {
            name: exam.name || 'Sin nombre',
            subject: exam.subject || null,
            count: 1
          })
        }
      }
    })

    const examsInfo: ExamInfo[] = Array.from(examsMap.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      subject: data.subject,
      gradeCount: data.count
    }))

    // Calcular porcentajes
    const gradesWithPercentage = validGrades.map(g => ({
      ...g,
      percentage: Math.round((g.score_obtained! / g.score_possible!) * 100)
    }))
    const percentages = gradesWithPercentage.map(g => g.percentage)

    // --- ESTADÍSTICAS GENERALES ---
    const classAverage = Math.round(percentages.reduce((sum, p) => sum + p, 0) / percentages.length)
    const highestScore = Math.max(...percentages)
    const lowestScore = Math.min(...percentages)
    const passingRate = Math.round((percentages.filter(p => p >= 60).length / percentages.length) * 100)

    // --- DISTRIBUCIÓN DE CALIFICACIONES ---
    const distributionRanges = [
      { range: '90-100', min: 90, max: 100 },
      { range: '80-89', min: 80, max: 89 },
      { range: '70-79', min: 70, max: 79 },
      { range: '60-69', min: 60, max: 69 },
      { range: '0-59', min: 0, max: 59 }
    ]

    const gradeDistribution: GradeDistribution[] = distributionRanges.map(({ range, min, max }) => {
      const gradesInRange = gradesWithPercentage.filter(g => g.percentage >= min && g.percentage <= max)
      return {
        range,
        count: gradesInRange.length,
        percentage: Math.round((gradesInRange.length / percentages.length) * 100),
        students: gradesInRange.map(g => ({ id: g.student_id, name: getStudentName(g) }))
      }
    })

    // --- PREGUNTAS MÁS FALLADAS ---
    const questionErrors: Map<string, { count: number; tema: string | null; students: StudentSummary[] }> = new Map()

    validGrades.forEach(grade => {
      let feedback = grade.ai_feedback
      if (typeof feedback === 'string') { try { feedback = JSON.parse(feedback) } catch (e) { return } }

      const evaluaciones = feedback?.informe_evaluacion?.evaluacion_detallada || []

      evaluaciones.forEach((pregunta: any) => {
        if (pregunta.evaluacion === 'INCORRECTO') {
          const questionId = pregunta.pregunta_id || 'Pregunta sin ID'
          const tema = pregunta.tema || null
          const studentName = getStudentName(grade)
          const studentId = grade.student_id

          if (questionErrors.has(questionId)) {
            const entry = questionErrors.get(questionId)!
            entry.count++
            entry.students.push({ id: studentId, name: studentName })
          } else {
            questionErrors.set(questionId, { 
              count: 1, 
              tema, 
              students: [{ id: studentId, name: studentName }] 
            })
          }
        }
      })
    })

    const topFailedQuestions: QuestionError[] = Array.from(questionErrors.entries())
      .map(([questionId, data]) => ({
        questionId,
        tema: data.tema,
        errorCount: data.count,
        percentage: Math.round((data.count / validGrades.length) * 100),
        failingStudents: data.students
      }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 3)

    // --- TIPOS DE ERROR (ACTUALIZADO PARA INCLUIR ESTUDIANTES) ---

    // Usamos un Map donde la clave es el tipo de error, 
    // y el valor contiene el conteo y otro Map interno para estudiantes (para evitar duplicados por ID)
    const errorTypesData: Map<string, { count: number; studentsMap: Map<string, string> }> = new Map()
    let totalErrors = 0

    validGrades.forEach(grade => {
      let feedback = grade.ai_feedback
      if (typeof feedback === 'string') { try { feedback = JSON.parse(feedback) } catch (e) { return } }

      const evaluaciones = feedback?.informe_evaluacion?.evaluacion_detallada || []

      // Obtener datos del estudiante actual
      const studentId = grade.student_id
      const studentName = getStudentName(grade)

      evaluaciones.forEach((pregunta: any) => {
        if (pregunta.tipo_de_error && pregunta.tipo_de_error !== 'ninguno') {
          const rawType = pregunta.tipo_de_error
          // Normalizar nombre del error
          const errorType = rawType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())

          // Inicializar si no existe
          if (!errorTypesData.has(errorType)) {
            errorTypesData.set(errorType, { count: 0, studentsMap: new Map() })
          }

          const entry = errorTypesData.get(errorType)!
          entry.count++
          // Guardamos al estudiante en un Map interno (ID -> Nombre) para evitar duplicados
          // si un estudiante comete el mismo error varias veces en el mismo examen
          entry.studentsMap.set(studentId, studentName)

          totalErrors++
        }
      })
    })

    // Transformar Map a Array final
    const errorTypesFrequency: ErrorTypeCount[] = Array.from(errorTypesData.entries())
      .map(([type, data]) => ({
        name: type,
        value: data.count,
        percentage: totalErrors > 0 ? Math.round((data.count / totalErrors) * 100) : 0,
        // Convertir el Map de estudiantes a Array de StudentSummary
        students: Array.from(data.studentsMap.entries()).map(([id, name]) => ({ id, name }))
      }))
      .sort((a, b) => b.value - a.value)

    // 6. Respuesta Final
    const analytics: ClassAnalytics = {
      success: true,
      classInfo: {
        id: classData.id,
        name: classData.name,
        totalStudents: uniqueStudents,
        totalGrades: validGrades.length
      },
      examsInfo,
      generalStats: { classAverage, highestScore, lowestScore, passingRate },
      gradeDistribution,
      topFailedQuestions,
      errorTypesFrequency
    }

    return NextResponse.json(analytics)

  } catch (error) {
    console.error('❌ Error fatal en la API:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: (error as Error).message },
      { status: 500 }
    )
  }
}