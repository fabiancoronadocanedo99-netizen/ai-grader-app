'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell
} from 'recharts'
import { ArrowLeft, TrendingUp, Users, BookOpen, Clock, ChevronRight } from 'lucide-react'
// --- CORRECCIÓN 1: Ruta de importación verificada ---
import { getSchoolDetailedAnalytics } from '@/actions/institutional-actions'

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface StudentRanking {
  id: string
  name: string
  average: number
  teacher: string
  subject: string
  trend: 'up' | 'down' | 'stable'
}

interface TeacherStats {
  id: string
  name: string
  average: number
  totalStudents: number
  totalGrades: number
  passRate: number
}

interface SubjectAverage {
  subject: string
  average: number
  totalGrades: number
}

interface SchoolAnalyticsData {
  success: boolean
  schoolInfo: {
    id: string
    name: string
    totalTeachers: number
    totalStudents: number
    totalExams: number
  }
  generalStats: {
    schoolAverage: number
    passRate: number
    totalGrades: number
  }
  subjectAverages: SubjectAverage[]
  teacherStats: TeacherStats[]
  topStudents: StudentRanking[]
  atRiskStudents: StudentRanking[]
}

// ─── CUSTOM TOOLTIPS (ESTILO NEUMÓRFICO) ──────────────────────────────────────

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#f0f2f5',
      borderRadius: '12px',
      padding: '12px',
      boxShadow: '6px 6px 12px #c8ccd1, -6px -6px 12px #ffffff',
      border: 'none',
      fontSize: '12px'
    }}>
      <p style={{ fontWeight: 800, color: '#2d3748', marginBottom: '4px' }}>{label}</p>
      <p style={{ color: '#5b8dee', fontWeight: 700 }}>Promedio: {payload[0].value}%</p>
    </div>
  )
}

const CustomRadarTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#f0f2f5',
      borderRadius: '12px',
      padding: '12px',
      boxShadow: '6px 6px 12px #c8ccd1, -6px -6px 12px #ffffff',
      border: 'none',
      fontSize: '12px'
    }}>
      <p style={{ fontWeight: 800, color: '#2d3748' }}>{payload[0].payload.subject}</p>
      <p style={{ color: '#5b8dee', fontWeight: 700 }}>{payload[0].value}%</p>
    </div>
  )
}

// ─── COMPONENTES INTERNOS ────────────────────────────────────────────────────

function AnimatedCounter({ target }: { target: number }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let start = 0
    if (target === 0) return
    const timer = setInterval(() => {
      start += Math.ceil(target / 40)
      if (start >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(start)
      }
    }, 25)
    return () => clearInterval(timer)
  }, [target])
  return <>{count.toLocaleString('es-MX')}</>
}

function KpiCard({ icon, label, value, sub, color }: any) {
  return (
    <div style={{
      background: '#f0f2f5', borderRadius: '24px', padding: '24px',
      boxShadow: '8px 8px 16px #c8ccd1, -8px -8px 16px #ffffff',
      display: 'flex', flexDirection: 'column', gap: '8px'
    }}>
      <div style={{ fontSize: '24px' }}>{icon}</div>
      <p style={{ fontSize: '11px', fontWeight: 800, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
      <p style={{ fontSize: '32px', fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: '11px', color: '#718096', fontWeight: 500 }}>{sub}</p>
    </div>
  )
}

function StudentRow({ student, variant }: { student: StudentRanking, variant: 'star' | 'alert' }) {
  return (
    <a href={`/dashboard/student/${student.id}`} style={{
      display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', borderRadius: '18px',
      background: '#f0f2f5', boxShadow: '4px 4px 10px #c8ccd1, -4px -4px 10px #ffffff',
      textDecoration: 'none', transition: 'all 0.2s ease'
    }}>
      <div style={{
        width: '40px', height: '40px', borderRadius: '50%',
        background: variant === 'star' ? 'linear-gradient(135deg, #ffd700, #ffaa00)' : 'linear-gradient(135deg, #fc8181, #e53e3e)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900
      }}>{student.name.charAt(0)}</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 800, color: '#2d3748', fontSize: '14px' }}>{student.name}</p>
        <p style={{ fontSize: '11px', color: '#a0aec0' }}>{student.subject} · {student.teacher}</p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontWeight: 900, color: variant === 'star' ? '#d69e2e' : '#e53e3e', fontSize: '16px' }}>{student.average}%</p>
        <p style={{ fontSize: '12px' }}>{student.trend === 'up' ? '↑' : '↓'}</p>
      </div>
    </a>
  )
}

// ─── PÁGINA PRINCIPAL ────────────────────────────────────────────────────────

export default function SchoolDetailedPage() {
  const params = useParams()
  const router = useRouter()

  // CORRECCIÓN 2: Manejo de Params para Next.js 15
  const schoolId = useMemo(() => {
    if (!params?.id) return null
    return Array.isArray(params.id) ? params.id[0] : params.id
  }, [params])

  const [data, setData] = useState<SchoolAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!schoolId) return
    async function load() {
      try {
        const result = await getSchoolDetailedAnalytics(schoolId!)
        if (result.success) {
          setData(result as any)
        } else {
          setError(result.error || 'Error al cargar datos')
        }
      } catch (err) {
        setError('Error de conexión')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [schoolId])

  if (loading || !schoolId) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="font-bold text-gray-500 animate-pulse">MINANDO DATOS INSTITUCIONALES...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-6">
        <div className="neu-card p-10 text-center max-w-md">
          <h2 className="text-2xl font-black text-red-500 mb-4 uppercase">Error de Acceso</h2>
          <p className="text-gray-600 mb-8 font-medium">{error}</p>
          <button onClick={() => router.back()} className="neu-button px-8 py-3 text-blue-600 font-bold uppercase text-xs">Volver</button>
        </div>
      </div>
    )
  }

  const { schoolInfo, generalStats, subjectAverages, teacherStats, topStudents, atRiskStudents } = data

  return (
    <div className="min-h-screen bg-[#f0f2f5] p-4 md:p-10" style={{ fontFamily: 'sans-serif' }}>

      {/* Botón Volver */}
      <button onClick={() => router.back()} className="neu-button px-5 py-2 text-xs font-black text-gray-500 uppercase mb-8 flex items-center gap-2">
        <ArrowLeft size={14} /> Centro de Mando
      </button>

      {/* Header */}
      <header className="mb-10 neu-card p-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">Análisis de Plantel</p>
          <h1 className="text-4xl font-black text-gray-800 tracking-tighter uppercase">{schoolInfo.name}</h1>
          <div className="flex gap-4 mt-4 text-xs font-bold text-gray-400 uppercase">
             <span>{schoolInfo.totalTeachers} Maestros</span>
             <span>•</span>
             <span>{schoolInfo.totalStudents} Alumnos</span>
          </div>
        </div>
        <div className="text-center p-6 rounded-3xl shadow-[inset_6px_6px_12px_#c8ccd1,inset_-6px_-6px_12px_#ffffff]">
           <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Promedio General</p>
           <p className="text-5xl font-black text-blue-600">{generalStats.schoolAverage}%</p>
        </div>
      </header>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <KpiCard icon="✅" label="Tasa Aprobación" value={`${generalStats.passRate}%`} color="#48bb78" sub="Alumnos con nota > 60%" />
        <KpiCard icon="📋" label="Evaluaciones" value={generalStats.totalGrades} color="#5b8dee" sub="Procesadas por AI Grader" />
        <KpiCard icon="⭐" label="Excelencia" value={topStudents.length} color="#d69e2e" sub="Alumnos destacados" />
        <KpiCard icon="🚨" label="En Riesgo" value={atRiskStudents.length} color="#e53e3e" sub="Atención psicopedagógica" />
      </div>

      {/* Savings Banner */}
      <div className="neu-card p-10 bg-gradient-to-br from-blue-600 to-blue-700 text-white mb-10 flex flex-col lg:flex-row items-center justify-between gap-8">
         <div className="flex items-center gap-8">
            <div className="p-5 bg-white/20 rounded-[30px] shadow-inner"><Clock size={48} /></div>
            <div>
               <p className="text-xs font-black uppercase tracking-widest opacity-70 mb-1">Carga Administrativa Eliminada</p>
               <h2 className="text-6xl font-black"><AnimatedCounter target={schoolInfo.totalExams * 10} /> min</h2>
            </div>
         </div>
         <div className="text-right border-l border-white/20 pl-8 hidden lg:block">
            <p className="text-xs font-black uppercase opacity-60">Impacto Mensual:</p>
            <p className="text-3xl font-black">{Math.round((schoolInfo.totalExams * 10) / 60)} HORAS DOCENTES</p>
            <p className="text-[10px] font-bold opacity-40 uppercase mt-1">Recuperadas para el acompañamiento</p>
         </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
        <div className="neu-card p-8">
          <h3 className="text-sm font-black text-gray-400 uppercase mb-8 flex items-center gap-2"><BookOpen size={16}/> Promedio por Materia</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={subjectAverages} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                <PolarGrid stroke="#cbd5e0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#718096', fontSize: 12, fontWeight: 700 }} />
                <Radar name="Promedio" dataKey="average" stroke="#5b8dee" fill="#5b8dee" fillOpacity={0.3} strokeWidth={3} />
                <Tooltip content={<CustomRadarTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="neu-card p-8">
          <h3 className="text-sm font-black text-gray-400 uppercase mb-8 flex items-center gap-2"><Users size={16}/> Ranking de Maestros</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teacherStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#718096', fontSize: 11, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="average" radius={[10, 10, 0, 0]}>
                  {teacherStats.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#5b8dee' : '#805ad5'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Rankings Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="neu-card p-8 border-t-8 border-yellow-400">
           <h3 className="text-sm font-black text-gray-800 uppercase mb-6 flex items-center gap-2">⭐ Cuadro de Honor</h3>
           <div className="flex flex-col gap-4">
              {topStudents.map(s => <StudentRow key={s.id} student={s} variant="star" />)}
           </div>
        </div>
        <div className="neu-card p-8 border-t-8 border-red-500">
           <h3 className="text-sm font-black text-gray-800 uppercase mb-6 flex items-center gap-2">🚨 Alertas de Rezago</h3>
           <div className="flex flex-col gap-4">
              {atRiskStudents.map(s => <StudentRow key={s.id} student={s} variant="alert" />)}
           </div>
        </div>
      </div>

    </div>
  )
}