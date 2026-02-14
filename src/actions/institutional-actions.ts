'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Calcula el porcentaje de una calificación de forma segura */
function calcPct(obtained: number, possible: number): number {
  if (!possible || possible === 0) return 0
  return (obtained / possible) * 100
}

/**
 * Calcula la tendencia de un alumno comparando sus últimas N calificaciones
 * vs sus primeras N calificaciones.
 * - 'up'     → promedio reciente > promedio antiguo + umbral
 * - 'down'   → promedio reciente < promedio antiguo - umbral
 * - 'stable' → sin cambio significativo
 */
function calcTrend(
  grades: { pct: number; created_at: string }[],
  threshold = 5
): 'up' | 'down' | 'stable' {
  if (grades.length < 2) return 'stable'

  const sorted = [...grades].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const half = Math.ceil(sorted.length / 2)
  const firstHalf = sorted.slice(0, half)
  const secondHalf = sorted.slice(half)

  const avgFirst = firstHalf.reduce((s, g) => s + g.pct, 0) / firstHalf.length
  const avgSecond = secondHalf.reduce((s, g) => s + g.pct, 0) / secondHalf.length

  const diff = avgSecond - avgFirst
  if (diff > threshold) return 'up'
  if (diff < -threshold) return 'down'
  return 'stable'
}

// ─── DASHBOARD INSTITUCIONAL ──────────────────────────────────────────────────

/**
 * Obtiene datos agregados para el Dashboard Institucional
 * (Organización Padre → Hijas)
 */
export async function getInstitutionalDashboardData() {
  const supabase = createAdminClient()

  try {
    const authClient = createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) throw new Error('No autorizado')

    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile?.organization_id) {
      throw new Error('No se pudo determinar la organización principal')
    }

    const parentId = userProfile.organization_id

    const { data: daughterOrgs, error: orgsError } = await supabase
      .from('organizations')
      .select('*')
      .eq('parent_id', parentId)

    if (orgsError) throw orgsError

    const detailedOrgs = await Promise.all(
      (daughterOrgs || []).map(async (org: any) => {
        const { count: userCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id)

        const { data: grades } = await supabase
          .from('grades')
          .select('score_obtained, score_possible')
          .eq('organization_id', org.id)

        const totalScore =
          grades?.reduce(
            (sum: number, g: any) => sum + calcPct(g.score_obtained, g.score_possible),
            0
          ) || 0
        const average =
          grades && grades.length > 0 ? totalScore / grades.length : 0

        const passCount =
          grades?.filter(g => calcPct(g.score_obtained, g.score_possible) >= 60).length || 0
        const passRate =
          grades && grades.length > 0
            ? Math.round((passCount / grades.length) * 100)
            : 0

        return {
          id: org.id,
          name: org.name,
          level: org.education_level || 'N/A',
          userCount: userCount || 0,
          average: Math.round(average),
          passRate,
          creditsRemaining: org.credits_remaining || 0,
          status:
            average >= 80 ? 'Exitoso' : average >= 60 ? 'En Riesgo' : 'Crítico'
        }
      })
    )

    const globalStats = {
      totalSchools: detailedOrgs.length,
      totalUsers: detailedOrgs.reduce((sum: number, org: any) => sum + org.userCount, 0),
      globalAverage:
        detailedOrgs.length > 0
          ? Math.round(
              detailedOrgs.reduce((sum: number, org: any) => sum + org.average, 0) /
                detailedOrgs.length
            )
          : 0,
      globalPassRate:
        detailedOrgs.length > 0
          ? Math.round(
              detailedOrgs.reduce((sum: number, org: any) => sum + org.passRate, 0) /
                detailedOrgs.length
            )
          : 0
    }

    return { success: true, schools: detailedOrgs, stats: globalStats }
  } catch (error) {
    console.error('Error en Institutional Dashboard:', error)
    return {
      success: false,
      error: (error as Error).message,
      schools: [],
      stats: { totalSchools: 0, totalUsers: 0, globalAverage: 0, globalPassRate: 0 }
    }
  }
}

// ─── MINERÍA PROFUNDA DE ESCUELA ──────────────────────────────────────────────

/**
 * Minería de datos profunda para el panel de análisis de una escuela específica.
 *
 * Enriquecimientos respecto a la versión previa:
 *  - passRate real calculado por maestro y materia
 *  - trend real (sin Math.random) calculado con calcTrend()
 *  - totalStudents únicos por maestro
 *  - highestScore / lowestScore por materia
 *  - creditsSaved derivado del total de exámenes (× 10 min)
 *  - subject del alumno estrella / en riesgo incluido
 *  - nombre del maestro incluido en ranking de alumnos
 */
export async function getSchoolDetailedAnalytics(schoolId: string) {
  const supabase = createAdminClient()

  try {
    // 1. Info básica de la escuela ──────────────────────────────────────────
    const { data: school, error: schoolError } = await supabase
      .from('organizations')
      .select('id, name, education_level, credits_remaining')
      .eq('id', schoolId)
      .single()

    if (schoolError || !school) throw new Error('Escuela no encontrada')

    // 2. Maestros de la escuela ─────────────────────────────────────────────
    const { data: teachers } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('organization_id', schoolId)
      .eq('role', 'teacher')

    const teacherMap = new Map(
      (teachers || []).map(t => [t.id, t.full_name ?? 'Docente'])
    )

    // 3. Calificaciones completas ───────────────────────────────────────────
    const { data: grades, error: gradesError } = await supabase
      .from('grades')
      .select(`
        id,
        score_obtained,
        score_possible,
        created_at,
        student_id,
        students ( full_name ),
        exams ( name, subject, user_id )
      `)
      .eq('organization_id', schoolId)

    if (gradesError) throw gradesError
    if (!grades || grades.length === 0) {
      return {
        success: true,
        schoolInfo: {
          id: school.id,
          name: school.name,
          educationLevel: school.education_level || 'N/A',
          totalTeachers: teachers?.length || 0,
          totalStudents: 0,
          totalExams: 0,
          creditsRemaining: school.credits_remaining || 0
        },
        generalStats: { schoolAverage: 0, passRate: 0, totalGrades: 0, creditsSaved: 0 },
        subjectAverages: [],
        teacherStats: [],
        topStudents: [],
        atRiskStudents: []
      }
    }

    // Pre-calcular pct para cada grade (evitar recalcular en cada loop)
    const gradesWithPct = grades.map(g => ({
      ...g,
      pct: Math.round(calcPct(g.score_obtained, g.score_possible))
    }))

    // 4. Estadísticas globales ──────────────────────────────────────────────
    const totalGrades = gradesWithPct.length
    const schoolAverage = Math.round(
      gradesWithPct.reduce((acc, g) => acc + g.pct, 0) / totalGrades
    )
    const passCount = gradesWithPct.filter(g => g.pct >= 60).length
    const passRate = Math.round((passCount / totalGrades) * 100)
    const creditsSaved = totalGrades * 10 // 10 min por examen

    // 5. Agrupación por Materia ─────────────────────────────────────────────
    const subjectsMap = new Map<
      string,
      { total: number; count: number; scores: number[] }
    >()

    gradesWithPct.forEach(g => {
      const subject = (g.exams as any)?.subject || 'Sin Materia'
      if (!subjectsMap.has(subject)) {
        subjectsMap.set(subject, { total: 0, count: 0, scores: [] })
      }
      const entry = subjectsMap.get(subject)!
      entry.total += g.pct
      entry.count++
      entry.scores.push(g.pct)
    })

    const subjectAverages = Array.from(subjectsMap.entries()).map(([subject, s]) => ({
      subject,
      average: Math.round(s.total / s.count),
      totalGrades: s.count,
      highestScore: Math.max(...s.scores),
      lowestScore: Math.min(...s.scores),
      passRate: Math.round(
        (s.scores.filter(p => p >= 60).length / s.scores.length) * 100
      )
    }))

    // 6. Agrupación por Maestro ─────────────────────────────────────────────
    const teacherStatsMap = new Map<
      string,
      {
        name: string
        total: number
        count: number
        passCount: number
        studentIds: Set<string>
      }
    >()

    gradesWithPct.forEach(g => {
      const tId = (g.exams as any)?.user_id ?? 'unknown'
      const tName = teacherMap.get(tId) ?? 'Docente'

      if (!teacherStatsMap.has(tId)) {
        teacherStatsMap.set(tId, {
          name: tName,
          total: 0,
          count: 0,
          passCount: 0,
          studentIds: new Set()
        })
      }
      const entry = teacherStatsMap.get(tId)!
      entry.total += g.pct
      entry.count++
      if (g.pct >= 60) entry.passCount++
      entry.studentIds.add(g.student_id)
    })

    const teacherStats = Array.from(teacherStatsMap.values()).map(t => ({
      name: t.name,
      average: Math.round(t.total / t.count),
      totalStudents: t.studentIds.size,
      totalGrades: t.count,
      passRate: Math.round((t.passCount / t.count) * 100)
    }))

    // 7. Ranking de Alumnos ─────────────────────────────────────────────────
    // Estructura: { id → { name, teacher, subject, grades: [{pct, created_at}] } }
    const studentPerfMap = new Map<
      string,
      {
        id: string
        name: string
        teacher: string
        subject: string
        grades: { pct: number; created_at: string }[]
      }
    >()

    gradesWithPct.forEach(g => {
      if (!studentPerfMap.has(g.student_id)) {
        const tId = (g.exams as any)?.user_id ?? 'unknown'
        studentPerfMap.set(g.student_id, {
          id: g.student_id,
          name: (g.students as any)?.full_name ?? 'Alumno',
          teacher: teacherMap.get(tId) ?? 'Docente',
          subject: (g.exams as any)?.subject ?? 'General',
          grades: []
        })
      }
      studentPerfMap.get(g.student_id)!.grades.push({
        pct: g.pct,
        created_at: g.created_at
      })
    })

    const allStudents = Array.from(studentPerfMap.values())
      .map(s => {
        const avg = Math.round(
          s.grades.reduce((acc, g) => acc + g.pct, 0) / s.grades.length
        )
        return {
          id: s.id,
          name: s.name,
          average: avg,
          teacher: s.teacher,
          subject: s.subject,
          trend: calcTrend(s.grades) // ✅ Tendencia real, no aleatoria
        }
      })
      .sort((a, b) => b.average - a.average)

    const uniqueStudentCount = allStudents.length

    // Top 5 estrellas (promedio ≥ 80) y Top 5 en riesgo (< 60)
    const topStudents = allStudents.filter(s => s.average >= 80).slice(0, 5)
    const atRiskStudents = allStudents
      .filter(s => s.average < 60)
      .reverse() // los de menor promedio primero
      .slice(0, 5)

    // 8. Respuesta final ────────────────────────────────────────────────────
    return {
      success: true,
      schoolInfo: {
        id: school.id,
        name: school.name,
        educationLevel: school.education_level || 'N/A',
        totalTeachers: teachers?.length || 0,
        totalStudents: uniqueStudentCount,
        totalExams: totalGrades,
        creditsRemaining: school.credits_remaining || 0
      },
      generalStats: {
        schoolAverage,
        passRate,
        totalGrades,
        creditsSaved // ✅ Calculado aquí, listo para el frontend
      },
      subjectAverages,  // ✅ Con highestScore, lowestScore y passRate por materia
      teacherStats,     // ✅ Con totalStudents únicos y passRate por maestro
      topStudents,
      atRiskStudents
    }
  } catch (error) {
    console.error('Error en Minería de Escuela:', error)
    return { success: false, error: (error as Error).message }
  }
}