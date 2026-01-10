'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import { sendStudentReportToParent } from '@/actions/user-actions' // Importamos la acción
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts'

// --- INTERFACES ---
interface GradeData {
  id: string
  examId: string
  examName: string
  type: 'exam' | 'assignment'
  scoreObtained: number | null
  scorePossible: number | null
  percentage: number
  createdAt: string
}

interface SWOTData {
  fortalezas: string
  oportunidades: string
  debilidades: string
  amenazas: string
}

interface DashboardData {
  success: boolean
  student: { id: string; fullName: string; studentEmail: string; tutorEmail: string }
  class: { name: string }
  grades: GradeData[]
  stats: {
    totalExams: number
    averageScore: number
    totalPoints: { obtained: number; possible: number }
    monthlyAverages: Array<{ month: string; average: number | null }>
  }
  swot: SWOTData | null
}

export default function StudentDashboardPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const studentId = params.studentId as string

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sendingReport, setSendingReport] = useState(false) // Estado para el envío de correo
  const [error, setError] = useState<string | null>(null)

  const [examWeight, setExamWeight] = useState(60)
  const [homeworkWeight, setHomeworkWeight] = useState(40)

  useEffect(() => {
    const fetchStudentDashboard = async () => {
      if (!studentId) return
      try {
        setLoading(true)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('No autorizado')

        const response = await fetch('/api/get-student-dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ studentId })
        })

        const data = await response.json()
        setDashboardData(data)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }
    fetchStudentDashboard()
  }, [studentId, supabase])

  const processed = useMemo(() => {
    if (!dashboardData) return null
    const exams = dashboardData.grades.filter(g => g.type === 'exam')
    const homeworks = dashboardData.grades.filter(g => g.type === 'assignment')
    const avgExams = exams.length > 0 ? exams.reduce((acc, curr) => acc + curr.percentage, 0) / exams.length : 0
    const avgHomeworks = homeworks.length > 0 ? homeworks.reduce((acc, curr) => acc + curr.percentage, 0) / homeworks.length : 0
    const finalGrade = (avgExams * (examWeight / 100)) + (avgHomeworks * (homeworkWeight / 100))
    const best = [...dashboardData.grades].sort((a, b) => b.percentage - a.percentage)[0]
    return { avgExams, avgHomeworks, finalGrade: Math.round(finalGrade), best, exams, homeworks }
  }, [dashboardData, examWeight, homeworkWeight])

  // Lógica de envío de reporte
  const handleSendReport = async () => {
    if (!dashboardData || !processed || !dashboardData.swot) {
      alert("Espera a que el análisis FODA esté listo antes de enviar.");
      return;
    }

    try {
      setSendingReport(true);
      const result = await sendStudentReportToParent({
        studentId: studentId,
        studentName: dashboardData.student.fullName,
        className: dashboardData.class.name,
        finalGrade: processed.finalGrade,
        swot: dashboardData.swot
      });

      if (result.success) {
        alert("✅ ¡Reporte enviado con éxito a los padres!");
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      alert("❌ Error al enviar reporte: " + (err as Error).message);
    } finally {
      setSendingReport(false);
    }
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#d1d9e6]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
  if (error || !dashboardData || !processed) return <div className="h-screen flex items-center justify-center bg-[#d1d9e6] p-8">{error}</div>

  return (
    <div className="min-h-screen bg-[#d1d9e6] p-4 md:p-8 text-gray-700">
      <div className="max-w-7xl mx-auto">

        {/* HEADER CON BOTÓN DE ENVÍO */}
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => router.back()} className="neu-button px-6 py-2 font-bold">← Volver</button>

          <button 
            onClick={handleSendReport}
            disabled={sendingReport || !dashboardData.swot}
            className={`neu-button px-6 py-2 font-black text-sm flex items-center gap-2 transition-all ${sendingReport ? 'opacity-50' : 'text-blue-700 active:shadow-inner'}`}
          >
            {sendingReport ? (
              <><span className="animate-spin">⏳</span> ENVIANDO...</>
            ) : (
              <><span className="text-lg">📧</span> ENVIAR REPORTE A PADRES</>
            )}
          </button>
        </div>

        {/* TARJETA DEL ESTUDIANTE */}
        <div className="neu-card p-6 mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-5xl font-black text-gray-800 tracking-tight">{dashboardData.student.fullName}</h1>
            <p className="text-gray-500 font-bold mt-1 uppercase text-xs tracking-widest">📚 {dashboardData.class.name}</p>
          </div>
          <div className="neu-card bg-white/20 p-4 px-10 text-center">
            <p className="text-[10px] uppercase font-black opacity-40 tracking-widest">Calificación Final</p>
            <div className="text-6xl font-black text-blue-700">{processed.finalGrade}%</div>
          </div>
        </div>

        {/* ... (Resto de los componentes: Pesos, Gráfica, FODA, Estadísticas, etc. se mantienen igual) ... */}

        {/* SECCIÓN FODA */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-black text-gray-800">🚀 Diagnóstico Pedagógico IA (FODA)</h2>
            <div className="h-1 flex-1 bg-gray-300 rounded-full opacity-30"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <SWOTCard title="Fortalezas" text={dashboardData.swot?.fortalezas} icon="💪" accent="border-green-500" iconBg="text-green-600" />
            <SWOTCard title="Oportunidades" text={dashboardData.swot?.oportunidades} icon="🚀" accent="border-blue-500" iconBg="text-blue-600" />
            <SWOTCard title="Debilidades" text={dashboardData.swot?.debilidades} icon="⚠️" accent="border-yellow-500" iconBg="text-yellow-600" />
            <SWOTCard title="Amenazas" text={dashboardData.swot?.amenazas} icon="🚩" accent="border-red-500" iconBg="text-red-600" />
          </div>
        </div>

        {/* (Continuar con Estadísticas e Historial...) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard title="Promedio" value={`${Math.round(processed.avgExams)}%`} icon="📝" color="text-blue-600" />
            <StatCard title="Tareas" value={`${Math.round(processed.avgHomeworks)}%`} icon="📚" color="text-purple-600" />
            <StatCard title="Mejor Nota" value={processed.best ? `${processed.best.percentage}%` : '---'} sub={processed.best?.examName} icon="🏆" color="text-green-600" />
            <StatCard title="Puntos" value={dashboardData.stats.totalPoints.obtained} sub={`de ${dashboardData.stats.totalPoints.possible}`} icon="🎯" color="text-orange-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="neu-card p-6">
            <h2 className="text-xl font-black mb-6 text-blue-800">📝 Exámenes</h2>
            <div className="space-y-4">
              {processed.exams.length === 0 ? <p className="opacity-30 italic text-center">Sin registros</p> : 
                processed.exams.map(g => <GradeRow key={g.id} grade={g} />)}
            </div>
          </div>
          <div className="neu-card p-6">
            <h2 className="text-xl font-black mb-6 text-purple-800">📚 Tareas</h2>
            <div className="space-y-4">
              {processed.homeworks.length === 0 ? <p className="opacity-30 italic text-center">Sin registros</p> : 
                processed.homeworks.map(g => <GradeRow key={g.id} grade={g} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- SUBCOMPONENTES (SWOTCard, WeightSlider, StatCard, GradeRow se mantienen igual que en la respuesta anterior) ---
function SWOTCard({ title, text, icon, accent, iconBg }: any) {
  return (
    <div className={`neu-card p-6 border-l-8 ${accent} transition-all hover:scale-[1.02] duration-300`}>
      <div className="flex items-center gap-4 mb-3">
        <div className={`text-2xl w-12 h-12 flex items-center justify-center rounded-2xl bg-[#d1d9e6] shadow-[inset_5px_5px_10px_#b8bfc9,inset_-5px_-5px_10px_#ffffff] ${iconBg}`}>
          {icon}
        </div>
        <h4 className={`text-sm uppercase font-black tracking-tighter ${iconBg}`}>{title}</h4>
      </div>
      <div className="min-h-[60px]">
        {text ? <p className="text-sm leading-relaxed text-gray-600 font-medium italic">"{text}"</p> : <div className="animate-pulse flex flex-col gap-2"><div className="h-3 bg-gray-300 rounded w-full"></div><div className="h-3 bg-gray-300 rounded w-5/6"></div></div>}
      </div>
    </div>
  )
}

function WeightSlider({ label, value, onChange, color }: any) {
  return (
    <div className="w-full">
      <div className="flex justify-between mb-2 text-xs font-black uppercase opacity-60"><span>{label}</span><span>{value}%</span></div>
      <input type="range" min="0" max="100" value={value} onChange={(e) => onChange(Number(e.target.value))} className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-300 shadow-inner`} />
    </div>
  )
}

function StatCard({ title, value, sub, icon, color }: any) {
  return (
    <div className="neu-card p-6 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-[10px] uppercase font-black opacity-40">{title}</p>
      <div className={`text-2xl font-black ${color}`}>{value}</div>
      {sub && <p className="text-[9px] font-bold opacity-60 truncate mt-1">{sub}</p>}
    </div>
  )
}

function GradeRow({ grade }: { grade: GradeData }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-3xl bg-[#d1d9e6] shadow-[inset_2px_2px_5px_#b8bfc9,inset_-2px_-2px_5px_#ffffff]">
      <div className="min-w-0 flex-1 pr-4">
        <h4 className="font-bold text-gray-800 text-sm truncate uppercase tracking-tighter">{grade.examName}</h4>
        <p className="text-[10px] font-bold opacity-40">{new Date(grade.createdAt).toLocaleDateString()}</p>
      </div>
      <div className="text-right">
        <div className={`text-lg font-black ${grade.percentage >= 60 ? 'text-blue-600' : 'text-red-600'}`}>{grade.percentage}%</div>
        <p className="text-[9px] font-black opacity-30">{grade.scoreObtained}/{grade.scorePossible} PTS</p>
      </div>
    </div>
  )
}