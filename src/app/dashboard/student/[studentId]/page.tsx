'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import { sendStudentReportToParent } from '@/actions/user-actions'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function StudentDashboardPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const studentId = params.studentId as string

  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  // Estados para pesos de calificación
  const [examWeight, setExamWeight] = useState(60)
  const [homeworkWeight, setHomeworkWeight] = useState(40)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/get-student-dashboard', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${session?.access_token}` 
          },
          body: JSON.stringify({ studentId })
        })
        const data = await res.json()
        setDashboardData(data)
      } catch (err) { 
        console.error("Error cargando dashboard:", err) 
      } finally { 
        setLoading(false) 
      }
    }
    fetchData()
  }, [studentId])

  // Lógica de cálculo de promedios ponderados
  const processed = useMemo(() => {
    if (!dashboardData) return null
    const exams = dashboardData.grades.filter((g: any) => g.type === 'exam')
    const homeworks = dashboardData.grades.filter((g: any) => g.type === 'assignment')

    const avgExams = exams.length ? exams.reduce((s:any, g:any) => s + g.percentage, 0) / exams.length : 0
    const avgHomeworks = homeworks.length ? homeworks.reduce((s:any, g:any) => s + g.percentage, 0) / homeworks.length : 0

    return {
      exams, 
      homeworks,
      finalGrade: Math.round((avgExams * (examWeight / 100)) + (avgHomeworks * (homeworkWeight / 100))),
      best: [...dashboardData.grades].sort((a, b) => b.percentage - a.percentage)[0]
    }
  }, [dashboardData, examWeight, homeworkWeight])

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#d1d9e6]">
        <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600 mb-4"></div>
            <p className="font-bold text-gray-600">Cargando Súper Dashboard...</p>
        </div>
    </div>
  )

  if (!dashboardData) return <div className="p-8 text-center">No se encontraron datos del estudiante.</div>

  return (
    <div className="min-h-screen bg-[#d1d9e6] p-4 md:p-8 text-gray-700">
      <div className="max-w-7xl mx-auto">

        {/* NAVEGACIÓN Y ACCIONES */}
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => router.back()} className="neu-button px-6 py-2 font-bold">← Volver</button>
          <button 
            onClick={async () => {
              setSending(true);
              const result = await sendStudentReportToParent({
                studentId, 
                studentName: dashboardData.student.fullName,
                className: dashboardData.class.name, 
                finalGrade: processed?.finalGrade || 0,
                swot: dashboardData.ai_swot
              });
              setSending(false);
              alert(result.success ? "✅ Reporte enviado a padres" : "❌ Error: " + result.error);
            }}
            disabled={sending}
            className="neu-button px-6 py-2 text-blue-700 font-black flex items-center gap-2"
          >
            {sending ? "⏳ ENVIANDO..." : "📧 ENVIAR REPORTE A PADRES"}
          </button>
        </div>

        {/* 1. CABECERA (DATOS PERSONALES) */}
        <div className="neu-card p-8 mb-8 flex justify-between items-center relative overflow-hidden">
          <div className="z-10">
            <h1 className="text-4xl font-black text-gray-800 mb-2 tracking-tight">{dashboardData.student.fullName}</h1>
            <p className="text-lg font-bold flex items-center gap-2">
                <span className="text-2xl">📚</span> Clase: <span className="opacity-70">{dashboardData.class.name}</span>
            </p>
            <div className="mt-4 space-y-1">
                <p className="text-sm opacity-60 flex items-center gap-2"><span>📧</span> {dashboardData.student.studentEmail || 'Sin correo'}</p>
                <p className="text-sm opacity-60 flex items-center gap-2"><span>👨‍👩‍👧</span> Tutor: {dashboardData.student.tutorEmail || 'Sin tutor'}</p>
            </div>
          </div>
          <div className="text-[120px] opacity-10 absolute right-10 bottom-[-20px] select-none">👤</div>
        </div>

        {/* 2. TARJETAS DE RESUMEN (ESTADÍSTICAS) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <StatCard 
            title="Promedio General" 
            value={`${processed?.finalGrade}%`} 
            sub="Calificación Ponderada" 
            icon="📊" 
            color="text-blue-700"
          />
          <StatCard 
            title="Evaluaciones" 
            value={dashboardData.stats.totalEvaluations} 
            sub="Pruebas realizadas" 
            icon="📝" 
            color="text-purple-700"
          />
          <StatCard 
            title="Puntos Totales" 
            value={`${dashboardData.stats.totalPoints.obtained}/${dashboardData.stats.totalPoints.possible}`} 
            sub="Puntos acumulados" 
            icon="🎯" 
            color="text-orange-600"
          />
        </div>

        {/* 3. SECCIÓN CENTRAL: CONFIGURACIÓN Y GRÁFICA DE EVOLUCIÓN */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">

          {/* Configuración de Pesos (Sliders) */}
          <div className="neu-card p-6 flex flex-col justify-between">
            <div>
                <h3 className="text-lg font-black mb-6 flex items-center gap-2">⚙️ Configuración de Pesos</h3>
                <div className="space-y-8">
                    <WeightSlider label="Exámenes" value={examWeight} onChange={(v:any) => {setExamWeight(v); setHomeworkWeight(100-v)}} />
                    <WeightSlider label="Tareas y Trabajos" value={homeworkWeight} onChange={(v:any) => {setHomeworkWeight(v); setExamWeight(100-v)}} />
                </div>
            </div>
            <div className="mt-6 p-4 bg-white/20 rounded-2xl border border-white/30">
                <p className="text-[10px] font-bold opacity-50 uppercase leading-tight">
                    * El promedio general se recalcula automáticamente basado en estos porcentajes.
                </p>
            </div>
          </div>

          {/* GRÁFICA DE EVOLUCIÓN MENSUAL */}
          <div className="neu-card p-6 lg:col-span-2">
            <h3 className="text-lg font-black mb-4 flex items-center gap-2">📈 Evolución Mensual del Rendimiento</h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboardData.stats.monthlyAverages}>
                  <defs>
                    <linearGradient id="colorGrade" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#bec8d9" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 12, fontWeight: 'bold', fill: '#64748b'}} 
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 12, fill: '#64748b'}} 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', backgroundColor: '#d1d9e6', boxShadow: '10px 10px 20px #b1b9c5' }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="average" 
                    stroke="#2563eb" 
                    strokeWidth={5} 
                    fillOpacity={1} 
                    fill="url(#colorGrade)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 4. DIAGNÓSTICO FODA IA */}
        <div className="mb-12">
          <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-gray-800">
            <span className="text-3xl">🚀</span> Diagnóstico Pedagógico IA (FODA)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SWOTCard title="Fortalezas" text={dashboardData.ai_swot?.fortalezas} icon="💪" color="border-green-500" iconColor="text-green-600" />
            <SWOTCard title="Oportunidades" text={dashboardData.ai_swot?.oportunidades} icon="🚀" color="border-blue-500" iconColor="text-blue-600" />
            <SWOTCard title="Debilidades" text={dashboardData.ai_swot?.debilidades} icon="⚠️" color="border-yellow-500" iconColor="text-yellow-600" />
            <SWOTCard title="Amenazas" text={dashboardData.ai_swot?.amenazas} icon="🚩" color="border-red-500" iconColor="text-red-600" />
          </div>
        </div>

        {/* 5. HISTORIAL DE EVALUACIONES (TABLA COMPLETA) */}
        <div className="neu-card p-8 mb-12">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-3xl">📋</span>
            <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Historial de Evaluaciones</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="py-4 font-black uppercase text-xs opacity-40 tracking-widest">Nombre de la Evaluación</th>
                  <th className="py-4 font-black uppercase text-xs opacity-40 tracking-widest text-center">Calificación</th>
                  <th className="py-4 font-black uppercase text-xs opacity-40 tracking-widest text-center">Porcentaje</th>
                  <th className="py-4 font-black uppercase text-xs opacity-40 tracking-widest text-right">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.grades.map((g:any) => (
                  <tr key={g.id} className="border-b border-gray-200 hover:bg-white/30 transition-all group">
                    <td className="py-5 font-bold text-gray-800 group-hover:pl-2 transition-all">{g.examName}</td>
                    <td className="py-5 text-center font-black text-gray-400">
                        {g.scoreObtained} <span className="text-[10px]">/</span> {g.scorePossible}
                    </td>
                    <td className="py-5 text-center">
                      <span className={`px-5 py-1.5 rounded-full font-black text-sm shadow-sm ${g.percentage >= 60 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {g.percentage}%
                      </span>
                    </td>
                    <td className="py-5 text-right text-xs font-bold opacity-50">
                        {new Date(g.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}

// --- COMPONENTES AUXILIARES CON ESTILO NEUMÓRFICO ---

function StatCard({ title, value, sub, icon, color }: any) {
  return (
    <div className="neu-card p-8 text-center relative overflow-hidden group">
      <div className="absolute top-4 right-4 text-3xl opacity-20 group-hover:scale-125 transition-transform">{icon}</div>
      <h3 className="text-sm font-black opacity-40 mb-3 uppercase tracking-widest">{title}</h3>
      <div className={`text-5xl font-black mb-2 ${color}`}>{value}</div>
      <p className="text-[10px] font-black uppercase opacity-40 tracking-tighter">{sub}</p>
    </div>
  )
}

function WeightSlider({ label, value, onChange }: any) {
  return (
    <div className="group">
      <div className="flex justify-between mb-3 font-black text-xs uppercase opacity-60 tracking-widest">
        <span>{label}</span>
        <span className="text-blue-700">{value}%</span>
      </div>
      <input 
        type="range" 
        min="0" max="100" 
        value={value} 
        onChange={(e) => onChange(Number(e.target.value))} 
        className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer shadow-inner accent-blue-600" 
      />
    </div>
  )
}

function SWOTCard({ title, text, icon, color, iconColor }: any) {
  return (
    <div className={`neu-card p-6 border-l-[10px] ${color} transition-all hover:translate-y-[-5px]`}>
      <div className="flex items-center gap-3 mb-3">
        <span className={`text-2xl ${iconColor}`}>{icon}</span>
        <h4 className={`font-black text-sm uppercase tracking-wider ${iconColor}`}>{title}</h4>
      </div>
      <p className="text-sm font-bold leading-relaxed text-gray-700 italic">
        {text ? `"${text}"` : "Generando análisis de rendimiento..."}
      </p>
    </div>
  )
}