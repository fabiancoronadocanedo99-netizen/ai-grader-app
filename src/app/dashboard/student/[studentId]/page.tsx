'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'

// --- INTERFACES ---
interface StudentData {
  id: string
  fullName: string
  studentEmail: string | null
  tutorEmail: string | null
  classId: string
  createdAt: string
}

interface ClassData {
  name: string
}

interface GradeData {
  id: string
  examId: string
  examName: string
  scoreObtained: number | null
  scorePossible: number | null
  percentage: number
  aiFeedback: any
  createdAt: string
}

interface StatsData {
  totalExams: number
  averageScore: number
  totalPoints: {
    obtained: number
    possible: number
  }
}

interface DashboardData {
  success: boolean
  student: StudentData
  class: ClassData
  grades: GradeData[]
  stats: StatsData
}

export default function StudentDashboardPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const studentId = params.studentId as string

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStudentDashboard = async () => {
      if (!studentId) {
        setError('ID de estudiante no proporcionado')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Obtener la sesión actual
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !session) {
          setError('No hay sesión activa. Por favor, inicia sesión.')
          setLoading(false)
          return
        }

        console.log('🔍 Obteniendo dashboard para estudiante:', studentId)

        // Llamar a la API
        const response = await fetch('/api/get-student-dashboard', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ studentId })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Error al obtener datos del estudiante')
        }

        const data: DashboardData = await response.json()
        console.log('✅ Dashboard obtenido:', data)

        setDashboardData(data)
      } catch (err) {
        console.error('❌ Error al cargar dashboard:', err)
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }

    fetchStudentDashboard()
  }, [studentId, supabase])

  // Estados de carga y error
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Cargando información del estudiante...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center p-8">
        <div className="neu-card p-8 max-w-lg w-full text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button 
            onClick={() => router.back()} 
            className="neu-button text-gray-700 font-semibold py-3 px-6"
          >
            ← Volver
          </button>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="flex h-screen items-center justify-center p-8">
        <div className="neu-card p-8 max-w-lg w-full text-center">
          <div className="text-6xl mb-4">🤔</div>
          <h2 className="text-2xl font-bold text-gray-700 mb-4">No se encontraron datos</h2>
          <p className="text-gray-600 mb-6">No se pudo cargar la información del estudiante.</p>
          <button 
            onClick={() => router.back()} 
            className="neu-button text-gray-700 font-semibold py-3 px-6"
          >
            ← Volver
          </button>
        </div>
      </div>
    )
  }

  const { student, class: classInfo, grades, stats } = dashboardData

  // Formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Obtener color según porcentaje
  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600'
    if (percentage >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Obtener color de fondo según porcentaje
  const getScoreBgColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-50'
    if (percentage >= 60) return 'bg-yellow-50'
    return 'bg-red-50'
  }

  return (
    <div className="neu-container min-h-screen p-8">
      {/* Encabezado */}
      <div className="mb-8">
        <button 
          onClick={() => router.back()} 
          className="neu-button text-gray-700 font-medium py-2 px-4 mb-4 inline-flex items-center gap-2"
        >
          ← Volver
        </button>

        <div className="neu-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-700 mb-2">
                {student.fullName}
              </h1>
              <p className="text-lg text-gray-600">
                📚 Clase: <span className="font-semibold">{classInfo.name}</span>
              </p>
              {student.studentEmail && (
                <p className="text-sm text-gray-500 mt-2">
                  📧 {student.studentEmail}
                </p>
              )}
              {student.tutorEmail && (
                <p className="text-sm text-gray-500">
                  👨‍👩‍👧 Tutor: {student.tutorEmail}
                </p>
              )}
            </div>
            <div className="text-6xl">👤</div>
          </div>
        </div>
      </div>

      {/* Tarjetas de Resumen (Estadísticas) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Promedio General */}
        <div className="neu-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Promedio General</h3>
            <span className="text-3xl">📊</span>
          </div>
          <div className="text-center">
            <div className={`text-5xl font-bold ${getScoreColor(stats.averageScore)}`}>
              {stats.averageScore}%
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Calificación promedio
            </p>
          </div>
        </div>

        {/* Total de Exámenes */}
        <div className="neu-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Evaluaciones</h3>
            <span className="text-3xl">📝</span>
          </div>
          <div className="text-center">
            <div className="text-5xl font-bold text-blue-600">
              {stats.totalExams}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {stats.totalExams === 1 ? 'Evaluación realizada' : 'Evaluaciones realizadas'}
            </p>
          </div>
        </div>

        {/* Puntos Totales */}
        <div className="neu-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Puntos Totales</h3>
            <span className="text-3xl">🎯</span>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600">
              {stats.totalPoints.obtained}
              <span className="text-2xl text-gray-400">/{stats.totalPoints.possible}</span>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Puntos obtenidos
            </p>
          </div>
        </div>
      </div>

      {/* Tabla de Calificaciones Detallada */}
      <div className="neu-card p-6">
        <h2 className="text-2xl font-bold text-gray-700 mb-6">
          📋 Historial de Evaluaciones
        </h2>

        {grades.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <p className="text-gray-600 text-lg">
              No hay evaluaciones registradas para este estudiante.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-4 px-4 font-semibold text-gray-700">
                    Nombre de la Evaluación
                  </th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-700">
                    Calificación
                  </th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-700">
                    Porcentaje
                  </th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-700">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody>
                {grades.map((grade, index) => (
                  <tr 
                    key={grade.id} 
                    className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                    }`}
                  >
                    {/* Nombre de la Evaluación */}
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-800">
                        {grade.examName}
                      </div>
                    </td>

                    {/* Calificación */}
                    <td className="py-4 px-4 text-center">
                      <span className="font-bold text-gray-700">
                        {grade.scoreObtained !== null ? grade.scoreObtained : 'N/A'}
                        <span className="text-gray-400"> / </span>
                        {grade.scorePossible !== null ? grade.scorePossible : 'N/A'}
                      </span>
                    </td>

                    {/* Porcentaje */}
                    <td className="py-4 px-4 text-center">
                      <span 
                        className={`inline-block px-4 py-2 rounded-full font-bold ${getScoreBgColor(grade.percentage)} ${getScoreColor(grade.percentage)}`}
                      >
                        {grade.percentage}%
                      </span>
                    </td>

                    {/* Fecha */}
                    <td className="py-4 px-4 text-center text-gray-600 text-sm">
                      {formatDate(grade.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Información Adicional (Opcional) */}
      {grades.length > 0 && (
        <div className="mt-8 neu-card p-6">
          <h3 className="text-xl font-bold text-gray-700 mb-4">
            📈 Análisis de Rendimiento
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="neu-card p-4 bg-gray-50/30">
              <p className="text-sm text-gray-600 mb-2">Mejor Calificación</p>
              <p className="text-2xl font-bold text-green-600">
                {Math.max(...grades.map(g => g.percentage))}%
              </p>
            </div>
            <div className="neu-card p-4 bg-gray-50/30">
              <p className="text-sm text-gray-600 mb-2">Evaluación Más Reciente</p>
              <p className="text-lg font-semibold text-gray-700">
                {grades[0]?.examName || 'N/A'}
              </p>
              <p className="text-sm text-gray-500">
                {grades[0] ? formatDate(grades[0].createdAt) : ''}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}