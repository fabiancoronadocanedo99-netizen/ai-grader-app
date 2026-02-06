'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabaseClient'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// --- INTERFACES ---

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

interface GradeEvaluation {
  gradeId: string
  studentId: string
  studentName: string
  examId: string
  examName: string
  examSubject: string | null
  scoreObtained: number
  scorePossible: number
  percentage: number
  aiFeedback: any
}

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
  students?: StudentSummary[]
}

interface AnalyticsData {
  success: boolean
  classInfo: ClassInfo
  examsInfo: ExamInfo[]
  evaluations: GradeEvaluation[]
  generalStats: GeneralStats
  gradeDistribution: GradeDistribution[]
  topFailedQuestions: QuestionError[]
  errorTypesFrequency: ErrorTypeCount[]
}

interface ExamOption {
  id: string
  name: string
}

// --- COMPONENTE MODAL DE ESTUDIANTES ---
const StudentListModal = ({ 
  isOpen, 
  onClose, 
  title, 
  students 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  students: StudentSummary[] 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="neu-card bg-white w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-700">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {students && students.length > 0 ? (
            <ul className="space-y-3">
              {students.map((student) => (
                <li key={student.id}>
                  <Link 
                    href={`/dashboard/student/${student.id}`}
                    className="flex items-center p-3 rounded-lg hover:bg-blue-50 transition-colors group"
                  >
                    <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold mr-3 group-hover:bg-blue-200">
                      {student.name.charAt(0)}
                    </span>
                    <span className="text-gray-700 font-medium group-hover:text-blue-700">
                      {student.name}
                    </span>
                    <span className="ml-auto text-gray-400 text-sm">Ver →</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-gray-500 py-8">No hay estudiantes en esta lista.</p>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 bg-gray-50 text-right">
          <button onClick={onClose} className="neu-button py-2 px-4 text-sm">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

// --- PÁGINA PRINCIPAL ---

export default function ClassAnalyticsPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const classId = params.classId as string

  // Estados de Datos
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [examsList, setExamsList] = useState<ExamOption[]>([])

  // Estados de Control
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedExamId, setSelectedExamId] = useState<string>('all')
  const [selectedSubject, setSelectedSubject] = useState<string>('Todas') // 🆕 NUEVO ESTADO

  // Estados del Modal
  const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; students: StudentSummary[] }>({
    isOpen: false,
    title: '',
    students: []
  })

  // 1. Cargar lista de exámenes para el dropdown
  useEffect(() => {
    const fetchExams = async () => {
      const { data } = await supabase
        .from('exams')
        .select('id, name')
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      if (data) setExamsList(data);
    };
    if (classId) fetchExams();
  }, [classId, supabase]);

  // 2. Cargar Analíticas
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

        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        console.log("SESSION OBJECT:", session);
        if (sessionError) console.error("Error al obtener la sesión:", sessionError);
        if (!session) console.log("¡NO SE ENCONTRÓ SESIÓN!");
        else console.log("ACCESS TOKEN:", session.access_token);

        if (sessionError || !session) {
          setError('No hay sesión activa. Por favor, inicia sesión.')
          setLoading(false)
          return
        }

        console.log(`🔍 Obteniendo analíticas para clase: ${classId}, Examen: ${selectedExamId}`)

        const requestBody: any = { classId };
        if (selectedExamId !== 'all') {
          requestBody.examId = selectedExamId;
        }

        const response = await fetch('/api/get-class-analytics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Error al obtener analíticas')
        }

        const data: AnalyticsData = await response.json()
        setAnalytics(data)
      } catch (err) {
        console.error('❌ Error al cargar analíticas:', err)
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [classId, selectedExamId, supabase])

  // 🆕 3. EXTRAER MATERIAS ÚNICAS
  const availableSubjects = useMemo(() => {
    if (!analytics?.examsInfo) return [];
    const subjects = analytics.examsInfo
      .map(exam => exam.subject)
      .filter((subject): subject is string => subject !== null && subject !== '');
    return ['Todas', ...Array.from(new Set(subjects))];
  }, [analytics?.examsInfo]);

  // 🆕 4. FILTRAR EVALUACIONES POR MATERIA
  const filteredEvaluations = useMemo(() => {
    if (!analytics?.evaluations) return [];
    if (selectedSubject === 'Todas') return analytics.evaluations;
    return analytics.evaluations.filter(evaluation => evaluation.examSubject === selectedSubject);
  }, [analytics?.evaluations, selectedSubject]);

  // 🆕 5. RECALCULAR KPIs BASADO EN EVALUACIONES FILTRADAS
  const recalculatedStats = useMemo(() => {
    if (!analytics) return null;
    if (filteredEvaluations.length === 0) {
      return { classAverage: 0, highestScore: 0, lowestScore: 0, passingRate: 0 };
    }

    const percentages = filteredEvaluations.map(e => e.percentage);
    const classAverage = Math.round(percentages.reduce((sum, p) => sum + p, 0) / percentages.length);
    const highestScore = Math.max(...percentages);
    const lowestScore = Math.min(...percentages);
    const passingRate = Math.round((percentages.filter(p => p >= 60).length / percentages.length) * 100);

    return { classAverage, highestScore, lowestScore, passingRate };
  }, [analytics, filteredEvaluations]);

  // 🆕 6. RECALCULAR PREGUNTAS FALLADAS DINÁMICAMENTE
  const filteredFailedQuestions = useMemo(() => {
    if (filteredEvaluations.length === 0) return [];

    const questionErrors = new Map<string, { 
      count: number; 
      tema: string | null; 
      students: StudentSummary[] 
    }>();

    filteredEvaluations.forEach(evaluation => {
      const feedback = evaluation.aiFeedback;
      const evaluaciones = feedback?.informe_evaluacion?.evaluacion_detallada || [];

      evaluaciones.forEach((pregunta: any) => {
        if (pregunta.evaluacion === 'INCORRECTO') {
          const questionId = pregunta.pregunta_id || 'Pregunta sin ID';
          const tema = pregunta.tema || null;
          const studentId = evaluation.studentId;
          const studentName = evaluation.studentName;

          if (questionErrors.has(questionId)) {
            const entry = questionErrors.get(questionId)!;
            entry.count++;
            // Evitar duplicados del mismo estudiante
            if (!entry.students.find(s => s.id === studentId)) {
              entry.students.push({ id: studentId, name: studentName });
            }
          } else {
            questionErrors.set(questionId, { 
              count: 1, 
              tema, 
              students: [{ id: studentId, name: studentName }] 
            });
          }
        }
      });
    });

    return Array.from(questionErrors.entries())
      .map(([questionId, data]) => ({
        questionId,
        tema: data.tema,
        errorCount: data.count,
        percentage: Math.round((data.count / filteredEvaluations.length) * 100),
        failingStudents: data.students
      }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 3);
  }, [filteredEvaluations]);

  // 🆕 7. RECALCULAR TIPOS DE ERROR DINÁMICAMENTE
  const filteredErrorTypes = useMemo(() => {
    if (filteredEvaluations.length === 0) return [];

    const errorTypesData = new Map<string, { 
      count: number; 
      studentsMap: Map<string, string> 
    }>();
    let totalErrors = 0;

    filteredEvaluations.forEach(evaluation => {
      const feedback = evaluation.aiFeedback;
      const evaluaciones = feedback?.informe_evaluacion?.evaluacion_detallada || [];

      evaluaciones.forEach((pregunta: any) => {
        if (pregunta.tipo_de_error && pregunta.tipo_de_error !== 'ninguno') {
          const rawType = pregunta.tipo_de_error;
          const errorType = rawType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

          if (!errorTypesData.has(errorType)) {
            errorTypesData.set(errorType, { count: 0, studentsMap: new Map() });
          }

          const entry = errorTypesData.get(errorType)!;
          entry.count++;
          entry.studentsMap.set(evaluation.studentId, evaluation.studentName);
          totalErrors++;
        }
      });
    });

    return Array.from(errorTypesData.entries())
      .map(([type, data]) => ({
        name: type,
        value: data.count,
        percentage: totalErrors > 0 ? Math.round((data.count / totalErrors) * 100) : 0,
        students: Array.from(data.studentsMap.entries()).map(([id, name]) => ({ id, name }))
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredEvaluations]);

  // 🆕 8. RECALCULAR DISTRIBUCIÓN DE CALIFICACIONES DINÁMICAMENTE
  const filteredGradeDistribution = useMemo(() => {
    if (filteredEvaluations.length === 0) return [];

    const distributionRanges = [
      { range: '90-100', min: 90, max: 100 },
      { range: '80-89', min: 80, max: 89 },
      { range: '70-79', min: 70, max: 79 },
      { range: '60-69', min: 60, max: 69 },
      { range: '0-59', min: 0, max: 59 }
    ];

    return distributionRanges.map(({ range, min, max }) => {
      const gradesInRange = filteredEvaluations.filter(e => e.percentage >= min && e.percentage <= max);
      return {
        range,
        count: gradesInRange.length,
        percentage: Math.round((gradesInRange.length / filteredEvaluations.length) * 100),
        students: gradesInRange.map(e => ({ id: e.studentId, name: e.studentName }))
      };
    });
  }, [filteredEvaluations]);

  // ANTIGUA LÓGICA - La mantenemos como fallback si no hay evaluations
  const filteredExamsInfo = useMemo(() => {
    if (!analytics?.examsInfo) return [];
    if (selectedSubject === 'Todas') return analytics.examsInfo;
    return analytics.examsInfo.filter(exam => exam.subject === selectedSubject);
  }, [analytics?.examsInfo, selectedSubject]);

  // 🆕 6. DATOS PARA GRÁFICO COMPARATIVO DE MATERIAS
  const subjectComparisonData = useMemo(() => {
    if (!analytics?.examsInfo) return [];

    // Agrupar exámenes por materia y calcular promedio
    const subjectGroups = new Map<string, { total: number; count: number }>();

    analytics.examsInfo.forEach(exam => {
      const subject = exam.subject || 'Sin materia';
      if (!subjectGroups.has(subject)) {
        subjectGroups.set(subject, { total: 0, count: 0 });
      }
      const group = subjectGroups.get(subject)!;
      // Aquí necesitaríamos el promedio de cada examen
      // Por ahora usamos gradeCount como proxy
      group.count += exam.gradeCount;
    });

    return Array.from(subjectGroups.entries()).map(([subject, data]) => ({
      subject,
      promedio: Math.round((data.count / analytics.examsInfo.length) * 100), // Placeholder
      evaluaciones: data.count
    }));
  }, [analytics?.examsInfo]);

  // 🆕 7. DATOS PARA GRÁFICO DE LÍNEA DE TIEMPO (MATERIA ESPECÍFICA)
  const subjectTimelineData = useMemo(() => {
    if (!analytics?.examsInfo || selectedSubject === 'Todas') return [];

    const filtered = analytics.examsInfo
      .filter(exam => exam.subject === selectedSubject)
      .map(exam => ({
        nombre: exam.name,
        promedio: 85, // Placeholder - necesitaríamos el promedio real del examen
        fecha: new Date().toLocaleDateString() // Placeholder
      }));

    return filtered;
  }, [analytics?.examsInfo, selectedSubject]);

  // Handlers para abrir el modal
  const openStudentModal = (title: string, students: StudentSummary[]) => {
    setModalState({ isOpen: true, title, students: students || [] });
  };

  const handleBarClick = (data: any) => {
    if (data && data.payload && data.payload.students) {
      openStudentModal(`Estudiantes en rango ${data.payload.range}`, data.payload.students);
    }
  };

  const handlePieClick = (data: any) => {
    if (data && data.payload) {
       const studentsList = data.payload.students || [];
       openStudentModal(`Estudiantes con error: ${data.name}`, studentsList);
    }
  };

  // Colores
  const DISTRIBUTION_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#dc2626']
  const ERROR_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899']
  const SUBJECT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

  // --- RENDERS DE CARGA Y ERROR ---
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Analizando datos...</p>
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
          <button onClick={() => router.back()} className="neu-button py-3 px-6">← Volver</button>
        </div>
      </div>
    )
  }

  if (!analytics) return null;

  const { classInfo } = analytics

  // Usar datos filtrados o datos originales como fallback
  const displayGradeDistribution = filteredGradeDistribution.length > 0 
    ? filteredGradeDistribution 
    : analytics.gradeDistribution;

  const displayFailedQuestions = filteredFailedQuestions.length > 0 
    ? filteredFailedQuestions 
    : analytics.topFailedQuestions;

  const displayErrorTypes = filteredErrorTypes.length > 0 
    ? filteredErrorTypes 
    : analytics.errorTypesFrequency;

  // Función auxiliar colores
  const getAverageColor = (avg: number) => {
    if (avg >= 80) return 'text-green-600'
    if (avg >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Datos transformados para PieChart
  const errorTypeChartData = displayErrorTypes.map(item => ({
    name: item.name,
    value: item.value,
    percentage: item.percentage, // ✅ Asegurar que percentage esté disponible
    students: item.students
  }));

  return (
    <div className="neu-container min-h-screen p-8 pb-20">
      {/* Encabezado y Filtros */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <button 
            onClick={() => router.back()} 
            className="neu-button text-gray-700 font-medium py-2 px-4 inline-flex items-center gap-2"
          >
            ← Volver
          </button>

          {/* --- FILTROS --- */}
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            {/* Filtro por Evaluación */}
            <select 
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="neu-input w-full md:w-64 p-3 bg-white cursor-pointer font-medium text-gray-700"
            >
              <option value="all">📊 Todas las Evaluaciones</option>
              <optgroup label="Exámenes y Tareas">
                {examsList.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    📝 {exam.name}
                  </option>
                ))}
              </optgroup>
            </select>

            {/* 🆕 Filtro por Materia */}
            {availableSubjects.length > 1 && (
              <select 
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="neu-input w-full md:w-64 p-3 bg-white cursor-pointer font-medium text-gray-700"
              >
                {availableSubjects.map((subject) => (
                  <option key={subject} value={subject}>
                    🔍 {subject}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="neu-card p-6">
          <h1 className="text-4xl font-bold text-gray-700 mb-2">
            📊 Análisis de Rendimiento
          </h1>
          <div className="flex flex-col md:flex-row justify-between items-end">
            <div>
              <p className="text-2xl text-gray-600 font-semibold">{classInfo.name}</p>
              <div className="flex gap-6 mt-2 text-sm text-gray-600">
                <span>👥 {classInfo.totalStudents} estudiantes</span>
                <span>📝 {classInfo.totalGrades} calificaciones analizadas</span>
                {selectedSubject !== 'Todas' && (
                  <span>📚 {filteredExamsInfo.length} evaluaciones de {selectedSubject}</span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-4 md:mt-0">
              {selectedExamId !== 'all' && (
                <span className="px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                  Filtrado por: {examsList.find(e => e.id === selectedExamId)?.name}
                </span>
              )}
              {selectedSubject !== 'Todas' && (
                <span className="px-4 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                  Materia: {selectedSubject}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Estadísticas Generales (Cards) - 🆕 CON RECALCULACIÓN */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="neu-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Promedio</h3>
            <span className="text-3xl">📊</span>
          </div>
          <div className="text-center">
            <div className={`text-5xl font-bold ${getAverageColor(recalculatedStats?.classAverage || 0)}`}>
              {recalculatedStats?.classAverage || 0}%
            </div>
          </div>
        </div>
        <div className="neu-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Mejor Nota</h3>
            <span className="text-3xl">🏆</span>
          </div>
          <div className="text-center">
            <div className="text-5xl font-bold text-green-600">{recalculatedStats?.highestScore || 0}%</div>
          </div>
        </div>
        <div className="neu-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Nota Baja</h3>
            <span className="text-3xl">📉</span>
          </div>
          <div className="text-center">
            <div className="text-5xl font-bold text-red-600">{recalculatedStats?.lowestScore || 0}%</div>
          </div>
        </div>
        <div className="neu-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Aprobación</h3>
            <span className="text-3xl">✅</span>
          </div>
          <div className="text-center">
            <div className={`text-5xl font-bold ${getAverageColor(recalculatedStats?.passingRate || 0)}`}>
              {recalculatedStats?.passingRate || 0}%
            </div>
          </div>
        </div>
      </div>

      {/* 🆕 GRÁFICO EVOLUTIVO INTELIGENTE */}
      <div className="neu-card p-6 mb-8">
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-2xl font-bold text-gray-700">
            {selectedSubject === 'Todas' ? '📊 Comparativa por Materia' : `📈 Evolución - ${selectedSubject}`}
          </h2>
        </div>

        {selectedSubject === 'Todas' ? (
          // Gráfico de barras comparativo entre materias
          subjectComparisonData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={subjectComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="subject" stroke="#6b7280" style={{ fontSize: '14px' }} />
                <YAxis stroke="#6b7280" style={{ fontSize: '14px' }} label={{ value: 'Evaluaciones', angle: -90, position: 'insideLeft' }} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px' }} />
                <Legend />
                <Bar 
                  dataKey="evaluaciones" 
                  name="Número de Evaluaciones" 
                  radius={[8, 8, 0, 0]}
                >
                  {subjectComparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={SUBJECT_COLORS[index % SUBJECT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-600 py-12">No hay datos de materias disponibles</p>
          )
        ) : (
          // Gráfico de línea temporal para materia específica
          subjectTimelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={subjectTimelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="nombre" stroke="#6b7280" style={{ fontSize: '12px' }} angle={-15} textAnchor="end" height={80} />
                <YAxis stroke="#6b7280" style={{ fontSize: '14px' }} domain={[0, 100]} label={{ value: 'Promedio (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip contentStyle={{ borderRadius: '8px' }} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="promedio" 
                  name="Promedio" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', r: 6 }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-600 py-12">No hay suficientes evaluaciones para mostrar progreso</p>
          )
        )}
      </div>

      {/* Gráfico de Distribución */}
      <div className="neu-card p-6 mb-8">
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-2xl font-bold text-gray-700">📈 Distribución de Calificaciones</h2>
          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">Click en las barras para ver alumnos</span>
        </div>

        {displayGradeDistribution.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={displayGradeDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="range" stroke="#6b7280" style={{ fontSize: '14px' }} />
              <YAxis stroke="#6b7280" style={{ fontSize: '14px' }} label={{ value: 'Cantidad', angle: -90, position: 'insideLeft' }} />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px' }} />
              <Legend />
              <Bar 
                dataKey="count" 
                name="Estudiantes" 
                radius={[8, 8, 0, 0]} 
                onClick={handleBarClick}
                className="cursor-pointer"
              >
                {displayGradeDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]} className="hover:opacity-80 transition-opacity" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-gray-600 py-12">No hay datos disponibles</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Top Preguntas */}
        <div className="neu-card p-6">
          <h2 className="text-2xl font-bold text-gray-700 mb-6">❌ Preguntas Más Falladas</h2>
          {displayFailedQuestions.length > 0 ? (
            <div className="space-y-4">
              {displayFailedQuestions.map((question, index) => (
                <button 
                  key={question.questionId} 
                  onClick={() => openStudentModal(`Alumnos que fallaron: ${question.questionId}`, question.failingStudents)}
                  className="w-full text-left neu-card p-4 bg-red-50/30 hover:bg-red-100/50 transition-all transform hover:-translate-y-1 active:translate-y-0"
                >
                  <div className="flex items-start justify-between pointer-events-none">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl font-bold text-red-600">#{index + 1}</span>
                        <h3 className="text-lg font-semibold text-gray-800 break-all">{question.questionId}</h3>
                      </div>
                      {question.tema && <p className="text-sm text-gray-600 mb-2">📚 Tema: {question.tema}</p>}
                      <p className="text-sm text-blue-600 font-medium underline decoration-blue-300">
                        Ver {question.errorCount} estudiante{question.errorCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-red-600">{question.percentage}%</div>
                      <p className="text-xs text-gray-500">de error</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12"><div className="text-6xl mb-4">✨</div><p>¡Excelente! No hay preguntas críticas.</p></div>
          )}
        </div>

        {/* Gráfico de Errores */}
        <div className="neu-card p-6">
          <h2 className="text-2xl font-bold text-gray-700 mb-6">🎯 Tipos de Error</h2>
          {displayErrorTypes.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={errorTypeChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: any) => `${entry.name}: ${entry.percentage}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    onClick={handlePieClick}
                    className="cursor-pointer"
                  >
                    {displayErrorTypes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={ERROR_COLORS[index % ERROR_COLORS.length]} className="hover:opacity-80" />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-6 space-y-2">
                {displayErrorTypes.map((error, index) => (
                  <div key={error.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: ERROR_COLORS[index % ERROR_COLORS.length] }} />
                      <span className="text-sm font-medium text-gray-700">{error.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-700">{error.percentage}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12"><div className="text-6xl mb-4">🎉</div><p>Sin errores registrados.</p></div>
          )}
        </div>
      </div>

      {/* --- MODAL GLOBAL --- */}
      <StudentListModal 
        isOpen={modalState.isOpen} 
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))} 
        title={modalState.title}
        students={modalState.students}
      />
    </div>
  )
}