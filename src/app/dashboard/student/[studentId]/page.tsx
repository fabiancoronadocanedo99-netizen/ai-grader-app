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
    if (!dashboardData?.grades) return null
    const exams = dashboardData.grades.filter((g: any) => g.type === 'exam')
    const homeworks = dashboardData.grades.filter((g: any) => g.type === 'assignment')
    const avgExams = exams.length ? exams.reduce((s:any, g:any) => s + g.percentage, 0) / exams.length : 0
    const avgHomeworks = homeworks.length ? homeworks.reduce((s:any, g:any) => s + g.percentage, 0) / homeworks.length : 0
    const sorted = [...dashboardData.grades].sort((a, b) => b.percentage - a.percentage)
    return {
      exams, homeworks,
      avgExams: Math.round(avgExams), avgHomeworks: Math.round(avgHomeworks),
      finalGrade: Math.round((avgExams * (examWeight / 100)) + (avgHomeworks * (homeworkWeight / 100))),
      best: sorted[0] || null
    }
  }, [dashboardData, examWeight, homeworkWeight])

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#d1d9e6] font-bold text-gray-500 italic animate-pulse">Cargando datos del alumno...</div>
  if (!dashboardData) return <div className="p-8">Error al cargar la información.</div>

  return (
    <div className="min-h-screen bg-[#d1d9e6] p-4 md:p-8 text-gray-700">
      <div className="max-w-7xl mx-auto">

        <div className="flex justify-between items-center mb-6">
          <button onClick={() => router.back()} className="neu-button px-6 py-2 font-bold">← Volver</button>
          <button 
            onClick={async () => {
              setSending(true);
              await sendStudentReportToParent({
                studentId, studentName: dashboardData.student?.fullName,
                className: dashboardData.class?.name, finalGrade: processed?.finalGrade || 0,
                swot: dashboardData.ai_swot
              });
              setSending(false);
              alert("Reporte enviado a padres.");
            }}
            className="neu-button px-6 py-2 text-blue-700 font-black"
          >
            {sending ? "⏳ ENVIANDO..." : "📧 ENVIAR REPORTE"}
          </button>
        </div>

        <div className="neu-card p-8 mb-8 flex justify-between items-center relative overflow-hidden">
          <div className="z-10">
            <h1 className="text-3xl font-black text-gray-800 mb-1">{dashboardData.student?.fullName || 'Alumno'}</h1>
            <p className="text-sm font-bold opacity-60 uppercase tracking-widest">📚 {dashboardData.class?.name}</p>
            <div className="mt-4 text-xs opacity-50 space-y-1">
                <p>📧 {dashboardData.student?.studentEmail}</p>
                <p>👨‍👩‍👧 {dashboardData.student?.tutorEmail}</p>
            </div>
          </div>
          <div className="text-[100px] opacity-10 absolute right-8 select-none">👤</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-center">
          <StatCard title="Promedio Final" value={`${processed?.finalGrade || 0}%`} sub="Cálculo Ponderado" icon="📊" />
          <StatCard title="Evaluaciones" value={dashboardData.stats?.totalEvaluations || 0} sub="Total realizadas" icon="📝" />
          <StatCard title="Puntos Totales" value={`${dashboardData.stats?.totalPoints?.obtained || 0}/${dashboardData.stats?.totalPoints?.possible || 0}`} sub="Acumulado real" icon="🎯" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="neu-card p-6 flex flex-col justify-center">
            <h3 className="text-sm font-black mb-6 uppercase opacity-40">⚙️ Pesos</h3>
            <div className="space-y-8">
              <WeightSlider label="Exámenes" value={examWeight} onChange={setExamWeight} />
              <WeightSlider label="Tareas" value={homeworkWeight} onChange={setHomeworkWeight} />
            </div>
          </div>
          <div className="neu-card p-6 lg:col-span-2">
            <h3 className="text-sm font-black mb-4 uppercase opacity-40 italic">📈 Evolución Mensual</h3>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboardData.stats?.monthlyAverages || []}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip contentStyle={{ borderRadius: '15px', border: 'none', backgroundColor: '#d1d9e6' }} />
                  <Area type="monotone" dataKey="average" stroke="#2563eb" strokeWidth={4} fill="#2563eb20" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-xl font-black mb-6 flex items-center gap-2">🚀 Diagnóstico IA (FODA)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SWOTCard title="Fortalezas" text={dashboardData.ai_swot?.fortalezas} icon="💪" color="border-green-500" />
            <SWOTCard title="Oportunidades" text={dashboardData.ai_swot?.oportunidades} icon="🚀" color="border-blue-500" />
            <SWOTCard title="Debilidades" text={dashboardData.ai_swot?.debilidades} icon="⚠️" color="border-yellow-500" />
            <SWOTCard title="Amenazas" text={dashboardData.ai_swot?.amenazas} icon="🚩" color="border-red-500" />
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-xl font-black mb-6">📈 Análisis de Rendimiento</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCardSmall title="Promedio" value={`${processed?.avgExams || 0}%`} icon="📝" color="text-blue-600" />
            <StatCardSmall title="Tareas" value={`${processed?.avgHomeworks || 0}%`} icon="📚" color="text-purple-600" />
            <StatCardSmall title="Mejor Nota" value={`${processed?.best?.percentage || 0}%`} sub={processed?.best?.examName} icon="🏆" color="text-green-600" />
            <StatCardSmall title="Puntos" value={dashboardData.stats?.totalPoints?.obtained || 0} sub={`de ${dashboardData.stats?.totalPoints?.possible || 0}`} icon="🎯" color="text-red-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ListContainer title="Exámenes" items={processed?.exams || []} color="text-blue-700" />
            <ListContainer title="Tareas" items={processed?.homeworks || []} color="text-purple-700" />
          </div>
        </div>

      </div>
    </div>
  )
}

// --- SUB-COMPONENTES CON PROTECCIÓN ---
function StatCard({ title, value, sub, icon }: any) {
  return (
    <div className="neu-card p-6">
      <div className="text-xl mb-1 opacity-40">{icon}</div>
      <h4 className="text-[10px] font-black uppercase opacity-40 tracking-tighter">{title}</h4>
      <div className="text-4xl font-black text-blue-700">{value}</div>
      <p className="text-[10px] font-bold opacity-30">{sub}</p>
    </div>
  )
}

function StatCardSmall({ title, value, sub, icon, color }: any) {
  return (
    <div className="neu-card p-4 text-center">
      <div className="text-lg mb-1">{icon}</div>
      <p className="text-[9px] font-black uppercase opacity-30">{title}</p>
      <div className={`text-xl font-black ${color}`}>{value}</div>
      {sub && <p className="text-[8px] font-bold opacity-40 truncate">{sub}</p>}
    </div>
  )
}

function WeightSlider({ label, value, onChange }: any) {
  return (
    <div>
      <div className="flex justify-between mb-1 text-[10px] font-black uppercase opacity-40"><span>{label}</span><span>{value}%</span></div>
      <input type="range" min="0" max="100" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer" />
    </div>
  )
}

function SWOTCard({ title, text, icon, color }: any) {
  return (
    <div className={`neu-card p-5 border-l-4 ${color}`}>
      <div className="flex items-center gap-2 mb-2 font-black text-xs uppercase opacity-70"><span>{icon}</span> {title}</div>
      <p className="text-xs font-medium italic text-gray-500 leading-relaxed">{text || "Analizando..."}</p>
    </div>
  )
}

function ListContainer({ title, items, color }: any) {
    return (
        <div className="neu-card p-6">
            <h3 className={`text-lg font-black mb-6 ${color}`}>📝 {title}</h3>
            <div className="space-y-4">
                {items.length === 0 ? <p className="text-xs opacity-30 italic">Sin registros</p> : items.map((g:any) => (
                    <div key={g.id} className="p-4 rounded-2xl bg-[#d1d9e6] shadow-[inset_3px_3px_6px_#b1b9c5,inset_-3px_-3px_6px_#f1f9ff] flex justify-between items-center">
                        <div>
                            <p className="font-black text-gray-800 uppercase text-[11px] tracking-tighter">{g.examName}</p>
                            <p className="text-[9px] font-bold opacity-30">{new Date(g.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-black text-blue-600">{g.percentage}%</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}