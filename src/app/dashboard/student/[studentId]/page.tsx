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
  }, [studentId, supabase])

  const processed = useMemo(() => {
    if (!dashboardData?.grades || dashboardData.grades.length === 0) return null
    const exams = dashboardData.grades.filter((g: any) => g.type === 'exam')
    const homeworks = dashboardData.grades.filter((g: any) => g.type === 'assignment')
    const avgExams = exams.length ? exams.reduce((s:any, g:any) => s + g.percentage, 0) / exams.length : 0
    const avgHomeworks = homeworks.length ? homeworks.reduce((s:any, g:any) => s + g.percentage, 0) / homeworks.length : 0
    const final = homeworks.length === 0 ? avgExams : (avgExams * (examWeight / 100)) + (avgHomeworks * (homeworkWeight / 100))
    const sorted = [...dashboardData.grades].sort((a, b) => b.percentage - a.percentage)
    const worst = [...dashboardData.grades].sort((a, b) => a.percentage - b.percentage)[0]
    return { exams, homeworks, avgExams: Math.round(avgExams), avgHomeworks: Math.round(avgHomeworks), finalGrade: Math.round(final), best: sorted[0], worst: worst }
  }, [dashboardData, examWeight, homeworkWeight])

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#d1d9e6] font-black italic text-gray-400 animate-pulse uppercase tracking-[0.3em]">Cargando Ficha Académica...</div>

  return (
    <div className="min-h-screen bg-[#d1d9e6] p-4 md:p-8 text-gray-700 font-sans">
      <div className="max-w-7xl mx-auto">

        <div className="flex justify-between items-center mb-8">
          <button onClick={() => router.back()} className="neu-button px-6 py-2 font-bold tracking-tighter">← VOLVER</button>
          <button 
            onClick={async () => {
              setSending(true);
              const result = await sendStudentReportToParent({
                studentId, studentName: dashboardData.student.fullName,
                className: dashboardData.class.name, finalGrade: processed?.finalGrade || 0,
                swot: dashboardData.ai_swot
              });
              setSending(false);
              alert(result.success ? "✅ Reporte enviado" : "Error al enviar");
            }}
            className="neu-button px-6 py-2 text-blue-700 font-black tracking-tighter"
          >
            {sending ? "ENVIANDO..." : "📧 ENVIAR REPORTE A PADRES"}
          </button>
        </div>

        <div className="neu-card p-10 mb-10 flex justify-between items-center relative overflow-hidden">
          <div className="z-10">
            <h1 className="text-5xl font-black text-gray-800 mb-2 tracking-tighter italic uppercase">{dashboardData.student.fullName}</h1>
            <p className="text-xl font-bold text-blue-600 flex items-center gap-2">📚 {dashboardData.class.name}</p>
            <div className="mt-4 flex gap-6 text-[10px] font-black opacity-40 uppercase tracking-widest">
              <span>📧 {dashboardData.student.studentEmail}</span>
              <span>👨‍👩‍👧 Tutor: {dashboardData.student.tutorEmail}</span>
            </div>
          </div>
          <div className="text-[150px] opacity-5 absolute right-10 bottom-[-40px] select-none font-black italic tracking-tighter">STUDENT</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 text-center">
          <StatCard title="Promedio Final" value={`${processed?.finalGrade || 0}%`} sub="Calificación Ponderada" icon="📊" color="text-blue-700" />
          <StatCard title="Evaluaciones" value={dashboardData.stats.totalEvaluations} sub="Pruebas Realizadas" icon="📝" color="text-purple-700" />
          <StatCard title="Puntos Totales" value={`${dashboardData.stats.totalPoints.obtained}/${dashboardData.stats.totalPoints.possible}`} sub="Puntos Acumulados" icon="🎯" color="text-orange-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-12">
          <div className="neu-card p-8 flex flex-col justify-center">
            <h3 className="text-xs font-black uppercase opacity-40 mb-8 tracking-[0.2em] italic">⚙️ Ajuste de Ponderación</h3>
            <div className="space-y-10">
              <WeightSlider label="Exámenes" value={examWeight} onChange={setExamWeight} />
              <WeightSlider label="Tareas" value={homeworkWeight} onChange={setHomeworkWeight} />
            </div>
          </div>
          <div className="neu-card p-8 lg:col-span-2 min-h-[300px]">
            <h3 className="text-xs font-black uppercase opacity-40 mb-6 tracking-[0.2em] italic">📈 Evolución Mensual del Rendimiento</h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboardData.stats.monthlyAverages} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs><linearGradient id="colorG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#bec8d9" opacity={0.5} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} interval={0} tick={{fontSize: 10, fontWeight: 'bold', fill: '#888'}} />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', backgroundColor: '#d1d9e6', boxShadow: '10px 10px 20px #b1b9c5' }} />
                  <Area type="monotone" dataKey="average" stroke="#2563eb" strokeWidth={5} fill="url(#colorG)" connectNulls={true} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mb-12">
            <h2 className="text-2xl font-black mb-6 uppercase italic tracking-tighter opacity-80">🚀 Foco Pedagógico</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <InsightCard title="🏆 Temas Dominados" items={dashboardData.pedagogicalInsights.mastered} color="border-green-500" badge="bg-green-100 text-green-700" />
                <InsightCard title="🔍 Temas a Reforzar" items={dashboardData.pedagogicalInsights.toReview} color="border-red-500" badge="bg-red-100 text-red-700" />
                <div className="neu-card p-8 border-t-8 border-blue-500">
                    <h3 className="text-[10px] font-black uppercase opacity-40 mb-4 tracking-widest">💡 Sugerencia IA</h3>
                    <p className="text-sm font-bold italic text-gray-600 leading-snug">"{dashboardData.pedagogicalInsights.recommendation}"</p>
                </div>
            </div>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-black mb-6 uppercase italic tracking-tighter opacity-80">📈 Análisis de Rendimiento</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10 text-center">
            <StatCardSmall title="Promedio Exámenes" value={`${processed?.avgExams || 0}%`} icon="📝" color="text-blue-600" />
            <StatCardSmall title="Promedio Tareas" value={`${processed?.avgHomeworks || 0}%`} icon="📚" color="text-purple-600" />
            <StatCardSmall title="Mejor Nota" value={`${processed?.best?.percentage || 0}%`} sub={processed?.best?.examName} icon="🏆" color="text-green-600" />
            <StatCardSmall title="Nota más Baja" value={`${processed?.worst?.percentage || 0}%`} sub={processed?.worst?.examName} icon="🚩" color="text-red-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <ListContainer title="Listado de Exámenes" items={processed?.exams || []} color="text-blue-700" />
            <ListContainer title="Trabajo y Tareas" items={processed?.homeworks || []} color="text-purple-700" />
          </div>
        </div>
      </div>

      <style jsx global>{`
        .neu-card { background: #d1d9e6; border-radius: 40px; box-shadow: 15px 15px 30px #b1b9c5, -15px -15px 30px #f1f9ff; border: 1px solid rgba(255, 255, 255, 0.2); }
        .neu-button { background: #d1d9e6; border-radius: 20px; box-shadow: 6px 6px 12px #b1b9c5, -6px -6px 12px #f1f9ff; border: 1px solid rgba(255, 255, 255, 0.3); transition: 0.2s; }
        .neu-button:active { box-shadow: inset 4px 4px 8px #b1b9c5, inset -4px -4px 8px #f1f9ff; transform: scale(0.98); }
        input[type=range] { -webkit-appearance: none; background: transparent; }
        input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 10px; background: #d1d9e6; border-radius: 10px; box-shadow: inset 2px 2px 5px #b1b9c5, inset -2px -2px 5px #f1f9ff; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 24px; width: 24px; border-radius: 50%; background: #2563eb; cursor: pointer; margin-top: -7px; box-shadow: 2px 2px 5px #b1b9c5; }
      `}</style>
    </div>
  )
}

function StatCard({ title, value, sub, icon, color }: any) {
  return (
    <div className="neu-card p-8 text-center relative group overflow-hidden">
      <div className="absolute top-4 right-4 text-3xl opacity-10 group-hover:scale-125 transition-transform">{icon}</div>
      <h4 className="text-[10px] font-black uppercase opacity-40 mb-2 tracking-widest">{title}</h4>
      <div className={`text-6xl font-black ${color} my-2 tracking-tighter`}>{value}</div>
      <p className="text-[10px] font-bold opacity-30 uppercase">{sub}</p>
    </div>
  )
}
function StatCardSmall({ title, value, sub, icon, color }: any) {
  return (
    <div className="neu-card p-6 text-center group">
      <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">{icon}</div>
      <p className="text-[9px] font-black uppercase opacity-30 mb-1">{title}</p>
      <div className={`text-3xl font-black ${color} tracking-tighter`}>{value}</div>
      {sub && <p className="text-[8px] font-bold opacity-40 truncate px-2 mt-1 uppercase">{sub}</p>}
    </div>
  )
}
function InsightCard({ title, items, color, badge }: any) {
    return (
        <div className={`neu-card p-8 border-t-8 ${color}`}>
            <h3 className="text-[10px] font-black uppercase opacity-40 mb-4 tracking-widest">{title}</h3>
            <div className="flex flex-wrap gap-2">
                {items.length > 0 ? items.map((t:any) => (
                    <span key={t} className={`${badge} px-3 py-1 rounded-full text-[10px] font-black uppercase shadow-sm tracking-tighter`}>{t}</span>
                )) : <p className="text-xs opacity-30 italic">Sin datos</p>}
            </div>
        </div>
    )
}
function WeightSlider({ label, value, onChange }: any) {
  return (
    <div>
      <div className="flex justify-between mb-3 text-[10px] font-black uppercase opacity-40"><span>{label}</span><span className="text-gray-800">{value}%</span></div>
      <input type="range" min="0" max="100" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full cursor-pointer" />
    </div>
  )
}
function ListContainer({ title, items, color }: any) {
    return (
        <div className="neu-card p-8">
            <h3 className={`text-lg font-black mb-6 ${color} uppercase tracking-widest italic`}>📝 {title}</h3>
            <div className="space-y-4">
                {items.map((g:any) => (
                    <div key={g.id} className="p-5 rounded-3xl bg-[#d1d9e6] shadow-[inset_4px_4px_8px_#b1b9c5,inset_-4px_-4px_8px_#f1f9ff] flex justify-between items-center group">
                        <div>
                            <p className="font-black text-gray-800 uppercase text-xs tracking-tighter">{g.examName}</p>
                            <p className="text-[9px] opacity-40 font-bold uppercase mt-1">{new Date(g.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-blue-600 tracking-tighter">{g.percentage}%</p>
                            <p className="text-[8px] font-black opacity-20 uppercase tracking-widest">Puntuación</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}