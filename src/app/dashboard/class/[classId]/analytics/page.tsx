'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// --- INTERFACES ---
interface ClassInfo {
  id: string
  name: string
  totalStudents: number
  totalGrades: number
}

interface GeneralStats {
  classAverage: number
  highestScore: number
  lowestScore: number
  passingRate: number
}

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
  name: string  // Recharts espera 'name' en lugar de 'type'
  value: number // Recharts espera 'value' en lugar de 'count'
  percentage: number
}

interface AnalyticsData {
  success: boolean
  classInfo: ClassInfo
  generalStats: GeneralStats
  gradeDistribution: GradeDistribution[]
  topFailedQuestions: QuestionError[]
  errorTypesFrequency: ErrorTypeCount[]
}

export default function ClassAnalyticsPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const classId = params.classId as string

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!classId) {
        setError('ID de clase no proporcionado')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Obtener sesión
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !session) {
          setError('No hay sesión activa. Por favor, inicia sesión.')
          setLoading(false)
          return
        }

        console.log('🔍 Obteniendo analíticas para clase:', classId)

        // Llamar a la API
        const response = await fetch('/api/get-class-analytics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ classId })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Error al obtener analíticas')
        }

        const data: AnalyticsData = await response.json()
        console.log('✅ Analíticas obtenidas:', data)

        setAnalytics(data)
      } catch (err) {
        console.error('❌ Error al cargar analíticas:', err)
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [classId, supabase])

  // Colores para las gráficas
  const DISTRIBUTION_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#dc2626']
  const ERROR_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899']

  // Estado de carga
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Analizando datos de la clase...</p>
        </div>
      </div>
    )
  }

  // Estado de error
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

  if (!analytics) {
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

  const { classInfo, generalStats, gradeDistribution, topFailedQuestions, errorTypesFrequency } = analytics

  // Formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Función para obtener color según promedio
  const getAverageColor = (avg: number) => {
    if (avg >= 80) return 'text-green-600'
    if (avg >= 60) return 'text-yellow-600'
    return 'text-red-600'
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
          <h1 className="text-4xl font-bold text-gray-700 mb-2">
            📊 Análisis de Rendimiento de la Clase
          </h1>
          <p className="text-2xl text-gray-600 font-semibold">{classInfo.name}</p>
          <div className="flex gap-6 mt-4 text-sm text-gray-600">
            <span>👥 {classInfo.totalStudents} estudiante{classInfo.totalStudents !== 1 ? 's' : ''}</span>
            <span>📝 {classInfo.totalGrades} evaluación{classInfo.totalGrades !== 1 ? 'es' : ''}</span>
          </div>
        </div>
      </div>

      {/* Estadísticas Generales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Promedio General */}
        <div className="neu-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Promedio General</h3>
            <span className="text-3xl">📊</span>
          </div>
          <div className="text-center">
            <div className={`text-5xl font-bold ${getAverageColor(generalStats.classAverage)}`}>
              {generalStats.classAverage}%
            </div>
            <p className="text-sm text-gray-500 mt-2">Calificación promedio</p>
          </div>
        </div>

        {/* Calificación Más Alta */}
        <div className="neu-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Mejor Nota</h3>
            <span className="text-3xl">🏆</span>
          </div>
          <div className="text-center">
            <div className="text-5xl font-bold text-green-600">
              {generalStats.highestScore}%
            </div>
            <p className="text-sm text-gray-500 mt-2">Calificación más alta</p>
          </div>
        </div>

        {/* Calificación Más Baja */}
        <div className="neu-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Nota Más Baja</h3>
            <span className="text-3xl">📉</span>
          </div>
          <div className="text-center">
            <div className="text-5xl font-bold text-red-600">
              {generalStats.lowestScore}%
            </div>
            <p className="text-sm text-gray-500 mt-2">Calificación más baja</p>
          </div>
        </div>

        {/* Tasa de Aprobación */}
        <div className="neu-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Aprobación</h3>
            <span className="text-3xl">✅</span>
          </div>
          <div className="text-center">
            <div className={`text-5xl font-bold ${getAverageColor(generalStats.passingRate)}`}>
              {generalStats.passingRate}%
            </div>
            <p className="text-sm text-gray-500 mt-2">Tasa de aprobación</p>
          </div>
        </div>
      </div>

      {/* Gráfico de Distribución de Calificaciones */}
      <div className="neu-card p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-700 mb-6">
          📈 Distribución de Calificaciones
        </h2>
        {gradeDistribution.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={gradeDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="range" 
                stroke="#6b7280"
                style={{ fontSize: '14px' }}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: '14px' }}
                label={{ value: 'Cantidad de Estudiantes', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              <Bar 
                dataKey="count" 
                name="Estudiantes"
                radius={[8, 8, 0, 0]}
              >
                {gradeDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-gray-600 py-12">No hay datos de distribución disponibles</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Top 3 Preguntas Más Falladas */}
        <div className="neu-card p-6">
          <h2 className="text-2xl font-bold text-gray-700 mb-6">
            ❌ Las 3 Preguntas Más Falladas
          </h2>
          {topFailedQuestions.length > 0 ? (
            <div className="space-y-4">
              {topFailedQuestions.map((question, index) => (
                <div 
                  key={question.questionId} 
                  className="neu-card p-4 bg-red-50/30"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl font-bold text-red-600">#{index + 1}</span>
                        <h3 className="text-lg font-semibold text-gray-800">
                          {question.questionId}
                        </h3>
                      </div>
                      {question.tema && (
                        <p className="text-sm text-gray-600 mb-2">
                          📚 Tema: {question.tema}
                        </p>
                      )}
                      <p className="text-sm text-gray-600">
                        {question.errorCount} estudiante{question.errorCount !== 1 ? 's' : ''} la fallaron
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-red-600">
                        {question.percentage}%
                      </div>
                      <p className="text-xs text-gray-500">de error</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">✨</div>
              <p className="text-gray-600">¡Excelente! No hay preguntas con muchos errores</p>
            </div>
          )}
        </div>

        {/* Gráfico de Tipos de Error */}
        <div className="neu-card p-6">
          <h2 className="text-2xl font-bold text-gray-700 mb-6">
            🎯 Tipos de Error Más Comunes
          </h2>
          {errorTypesFrequency.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={errorTypesFrequency}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: any) => `${entry.name}: ${entry.percentage}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {errorTypesFrequency.map((entry: ErrorTypeCount, index: number) => (
                      <Cell key={`cell-${index}`} fill={ERROR_COLORS[index % ERROR_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Leyenda personalizada */}
              <div className="mt-6 space-y-2">
                {errorTypesFrequency.map((error, index) => (
                  <div key={error.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: ERROR_COLORS[index % ERROR_COLORS.length] }}
                      />
                      <span className="text-sm font-medium text-gray-700">{error.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-gray-700">{error.value}</span>
                      <span className="text-xs text-gray-500 ml-1">({error.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎉</div>
              <p className="text-gray-600">¡Perfecto! No se han registrado errores</p>
            </div>
          )}
        </div>
      </div>

      {/* Recomendaciones */}
      {(topFailedQuestions.length > 0 || errorTypesFrequency.length > 0) && (
        <div className="neu-card p-6">
          <h2 className="text-2xl font-bold text-gray-700 mb-4">
            💡 Recomendaciones
          </h2>
          <div className="space-y-3 text-gray-700">
            {generalStats.classAverage < 70 && (
              <p className="flex items-start gap-2">
                <span className="text-xl">📌</span>
                <span>
                  El promedio de la clase está por debajo del 70%. Considera realizar sesiones de repaso o tutorías adicionales.
                </span>
              </p>
            )}
            {topFailedQuestions.length > 0 && (
              <p className="flex items-start gap-2">
                <span className="text-xl">📌</span>
                <span>
                  Las preguntas <strong>{topFailedQuestions.map(q => q.questionId).join(', ')}</strong> necesitan atención especial. 
                  Considera explicar estos temas nuevamente en clase.
                </span>
              </p>
            )}
            {errorTypesFrequency.length > 0 && errorTypesFrequency[0].percentage > 40 && (
              <p className="flex items-start gap-2">
                <span className="text-xl">📌</span>
                <span>
                  Los errores de tipo <strong>{errorTypesFrequency[0].name}</strong> son muy frecuentes ({errorTypesFrequency[0].percentage}%). 
                  Refuerza este aspecto en las próximas clases.
                </span>
              </p>
            )}
            {generalStats.passingRate < 70 && (
              <p className="flex items-start gap-2">
                <span className="text-xl">📌</span>
                <span>
                  La tasa de aprobación es del {generalStats.passingRate}%. Considera ajustar la dificultad de las evaluaciones 
                  o proporcionar más recursos de estudio.
                </span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}