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
  const [examWeight, setExamWeight] = useState(60)
  const [homeworkWeight, setHomeworkWeight] = useState(40)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/get-student-dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ studentId })
        })
        const data = await res.json()
        setDashboardData(data)
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    fetchData()
  }, [studentId])

  const processed = useMemo(() => {
    if (!dashboardData?.grades || dashboardData.grades.length === 0) return null

    // Filtramos usando el campo 'type' que acabamos de ver en tu tabla
    const exams = dashboardData.grades.filter((g: any) => g.type === 'exam')
    const homeworks = dashboardData.grades.filter((g: any) => g.type === 'assignment')

    const avgExams = exams.length ? exams.reduce((s:any, g:any) => s + g.percentage, 0) / exams.length : 0
    const avgHomeworks = homeworks.length ? homeworks.reduce((s:any, g:any) => s + g.percentage, 0) / homeworks.length : 0

    // Cálculo de calificación final proyectada
    let final;
    if (homeworks.length === 0) {
        final = avgExams
    } else if (exams.length === 0) {
        final = avgHomeworks
    } else {
        final = (avgExams * (examWeight / 100)) + (avgHomeworks * (homeworkWeight / 100))
    }

    const sorted = [...dashboardData.grades].sort((a, b) => b.percentage - a.percentage)

    return {
      exams, homeworks,
      avgExams: Math.round(avgExams),
      avgHomeworks: Math.round(avgHomeworks),
      finalGrade: Math.round(final),
      best: sorted[0]
    }
  }, [dashboardData, examWeight, homeworkWeight])

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#d1d9e6] font-bold">Cargando Dashboard...</div>
  if (!dashboardData) return <div className="p-8 text-center text-red-500 font-bold">Error de conexión.</div>

  return (
    <div className="min-h-screen bg-[#d1d9e6] p-4 md:p-8 text-gray-700">
      <div className="max-w-7xl mx-auto">

        {/* ACCIONES */}
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => router.back()} className="neu-button px-6 py-2 font-bold tracking-tighter">← Volver</button>
          <button 
            onClick={async () => {
              setSending(true);
              await sendStudentReportToParent({
                studentId, studentName: dashboardData.student.fullName,
                className: dashboardData.class.name, finalGrade: processed?.finalGrade || 0,
                swot: dashboardData.ai_swot
              });
              setSending(false);
              alert("✅ Reporte enviado a padres");
            }}
            className="neu-button px-6 py-2 text-blue-700 font-black tracking-tighter"
          >
            {sending ? "Enviando..." : "📧 Enviar Reporte"}
          </button>
        </div>

        {/* CABECERA ALUMNO */}
        <div className="neu-card p-8 mb-8 flex justify-between items-center relative overflow-hidden">
          <div className="z-10">
            <h1 className="text-4xl font-black text-gray-800 mb-2">{dashboardData.student.fullName}</h1>
            <p className="text-lg font-bold">📚 Clase: <span className="opacity-70">{dashboardData.class.name}</span></p>
            <div className="mt-4 space-y-1">
                <p className="text-xs opacity-50 font-bold uppercase tracking-widest">📧 {dashboardData.student.studentEmail}</p>
                <p className="text-xs opacity-50 font-bold uppercase tracking-widest">👨‍👩‍👧 {dashboardData.student.tutorEmail}</p>
            </div>
          </div>
          <div className="text-[120px] opacity-10 absolute right-10 bottom-[-20px] select-none">👤</div>
        </div>

        {/* CONTENEDORES PRINCIPALES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 text-center">
          <StatCard title="Promedio Final" value={`${processed?.finalGrade || 0}%`} sub="Cálculo Ponderado" icon="📊" />
          <StatCard title="Evaluaciones" value={dashboardData.stats.totalEvaluations} sub="Total realizadas" icon="📝" />
          <StatCard title="Puntos Totales" value={`${dashboardData.stats.totalPoints.obtained}/${dashboardData.stats.totalPoints.possible}`} sub="Puntos acumulados" icon="🎯" />
        </div>

        {/* CONFIG Y GRÁFICA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="neu-card p-6">
            <h3 className="text-lg font-black mb-6 uppercase opacity-40">⚙️ Pesos</h3>
            <div className="space-y-8">
              <WeightSlider label="Exámenes" value={examWeight} onChange={setExamWeight} />
              <WeightSlider label="Tareas" value={homeworkWeight} onChange={setHomeworkWeight} />
            </div>
          </div>
          <div className="neu-card p-6 lg:col-span-2">
            <h3 className="text-lg font-black mb-4 uppercase opacity-40">📈 Evolución</h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboardData.stats.monthlyAverages}>
                  <Area type="monotone" dataKey="average" stroke="#2563eb" strokeWidth={4} fill="#2563eb20" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
                  <YAxis hide domain={[0,100]} />
                  <Tooltip contentStyle={{ borderRadius: '15px', border: 'none', backgroundColor: '#d1d9e6' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* FODA IA */}
        <div className="mb-12">
          <h2 className="text-2xl font-black mb-6 flex items-center gap-2">🚀 Diagnóstico Pedagógico IA (FODA)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-800">
            <SWOTCard title="Fortalezas" text={dashboardData.ai_swot?.fortalezas} icon="💪" color="border-green-500" />
            <SWOTCard title="Oportunidades" text={dashboardData.ai_swot?.oportunidades} icon="🚀" color="border-blue-500" />
            <SWOTCard title="Debilidades" text={dashboardData.ai_swot?.debilidades} icon="⚠️" color="border-yellow-500" />
            <SWOTCard title="Amenazas" text={dashboardData.ai_swot?.amenazas} icon="🚩" color="border-red-500" />
          </div>
        </div>

        {/* ANÁLISIS RENDIMIENTO */}
        <div className="mb-12">
          <h2 className="text-2xl font-black mb-6">📈 Análisis de Rendimiento</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8 text-center">
            <StatCardSmall title="Promedio" value={`${processed?.avgExams || 0}%`} icon="📝" color="text-blue-600" />
            <StatCardSmall title="Tareas" value={`${processed?.avgHomeworks || 0}%`} icon="📚" color="text-purple-600" />
            <StatCardSmall title="Mejor Nota" value={`${processed?.best?.percentage || 0}%`} sub={processed?.best?.examName} icon="🏆" color="text-green-600" />
            <StatCardSmall title="Puntos" value={dashboardData.stats.totalPoints.obtained} sub={`de ${dashboardData.stats.totalPoints.possible}`} icon="🎯" color="text-red-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="neu-card p-6">
                <h3 className="text-xl font-black mb-6 text-blue-700">📝 Exámenes</h3>
                <div className="space-y-4">
                    {processed?.exams.map((g:any) => (
                        <div key={g.id} className="p-4 rounded-3xl bg-[#d1d9e6] shadow-[inset_4px_4px_8px_#b1b9c5,inset_-4px_-4px_8px_#f1f9ff] flex justify-between items-center">
                            <div><p className="font-black text-gray-800 uppercase text-xs">{g.examName}</p><p className="text-[9px] opacity-40 font-bold">{new Date(g.createdAt).toLocaleDateString()}</p></div>
                            <div className="text-right"><p className="text-lg font-black text-blue-600">{g.percentage}%</p></div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="neu-card p-6">
                <h3 className="text-xl font-black mb-6 text-purple-700">📚 Tareas</h3>
                <div className="space-y-4">
                    {processed?.homeworks.map((g:any) => (
                        <div key={g.id} className="p-4 rounded-3xl bg-[#d1d9e6] shadow-[inset_4px_4px_8px_#b1b9c5,inset_-4px_-4px_8px_#f1f9ff] flex justify-between items-center">
                            <div><p className="font-black text-gray-800 uppercase text-xs">{g.examName}</p><p className="text-[9px] opacity-40 font-bold">{new Date(g.createdAt).toLocaleDateString()}</p></div>
                            <div className="text-right"><p className="text-lg font-black text-purple-600">{g.percentage}%</p></div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// --- SUBCOMPONENTES ---
function StatCard({ title, value, sub, icon }: any) {
  return (
    <div className="neu-card p-8"><div className="text-2xl mb-2 opacity-30">{icon}</div><h4 className="text-xs font-black uppercase opacity-40 tracking-widest">{title}</h4><div className="text-5xl font-black text-blue-700 my-1">{value}</div><p className="text-[10px] font-bold opacity-40">{sub}</p></div>
  )
}
function StatCardSmall({ title, value, sub, icon, color }: any) {
  return (
    <div className="neu-card p-6"><div className="text-2xl mb-1">{icon}</div><p className="text-[10px] font-black uppercase opacity-40 mb-1">{title}</p><div className={`text-2xl font-black ${color}`}>{value}</div>{sub && <p className="text-[8px] font-bold opacity-50 truncate mt-1">{sub}</p>}</div>
  )
}
function WeightSlider({ label, value, onChange }: any) {
  return (
    <div><div className="flex justify-between mb-2 text-xs font-black uppercase opacity-40"><span>{label}</span><span>{value}%</span></div><input type="range" min="0" max="100" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer" /></div>
  )
}
function SWOTCard({ title, text, icon, color }: any) {
  return (
    <div className={`neu-card p-6 border-l-8 ${color}`}><div className="flex items-center gap-3 mb-2 font-black uppercase tracking-tighter"><span>{icon}</span> {title}</div><p className="text-sm font-medium italic text-gray-600 leading-relaxed">{text || "Generando..."}</p></div>
  )
}