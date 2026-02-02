'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getInstitutionalDashboardData } from '@/actions/institutional-actions'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import {
  School,
  Users,
  TrendingUp,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Map as MapIcon
} from 'lucide-react'

export default function InstitutionalDashboardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  // Evitamos errores de hidratación con Recharts
  useEffect(() => {
    setMounted(true)
    async function loadData() {
      try {
        const result = await getInstitutionalDashboardData()
        if (result.success) {
          setData(result)
        }
      } catch (error) {
        console.error("Error cargando datos institucionales:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (!mounted || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#d1d9e6]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const stats = data?.stats || { totalSchools: 0, totalUsers: 0, globalAverage: 0 }
  const schools = data?.schools || []

  return (
    <div className="min-h-screen bg-[#d1d9e6] p-4 md:p-8 font-sans">

      {/* Encabezado */}
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 neu-card rounded-xl text-blue-600">
            <MapIcon size={24} />
          </div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tighter uppercase">
            Centro de Mando
          </h1>
        </div>
        <p className="text-gray-600 font-medium ml-14 uppercase text-xs tracking-widest">
          Inteligencia Estatal y Desempeño Académico
        </p>
      </header>

      {/* Tarjetas de Resumen Global */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="neu-card p-6 border-l-8 border-blue-500">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Planteles Públicos</p>
          <h3 className="text-3xl font-black text-gray-800">{stats.totalSchools}</h3>
        </div>

        <div className="neu-card p-6 border-l-8 border-purple-500">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Docentes en Sistema</p>
          <h3 className="text-3xl font-black text-gray-800">{stats.totalUsers}</h3>
        </div>

        <div className="neu-card p-6 border-l-8 border-green-500">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Promedio General</p>
          <h3 className="text-3xl font-black text-gray-800">{stats.globalAverage}%</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gráfico */}
        <div className="neu-card p-6">
          <h2 className="text-sm font-bold text-gray-500 mb-6 uppercase tracking-tighter flex items-center gap-2">
            <TrendingUp size={16} />
            Comparativa de Rendimiento
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={schools}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#b8c1ce" />
                <XAxis dataKey="name" hide />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{fill: 'rgba(255,255,255,0.2)'}}
                  contentStyle={{ backgroundColor: '#d1d9e6', borderRadius: '12px', border: 'none' }}
                />
                <Bar dataKey="average" radius={[4, 4, 0, 0]}>
                  {schools.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.average >= 80 ? '#10b981' : entry.average >= 60 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lista con Semáforo */}
        <div className="neu-card p-6">
          <h2 className="text-sm font-bold text-gray-500 mb-6 uppercase tracking-tighter flex items-center gap-2">
            <School size={16} />
            Estatus de Escuelas
          </h2>
          <div className="space-y-3">
            {schools.map((school: any) => (
              <div key={school.id} className="flex items-center justify-between p-3 bg-white/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={
                    school.average >= 80 ? 'text-green-500' : 
                    school.average >= 60 ? 'text-yellow-500' : 
                    'text-red-500'
                  }>
                    {school.average >= 80 ? <CheckCircle2 size={18} /> : 
                     school.average >= 60 ? <AlertTriangle size={18} /> : 
                     <XCircle size={18} />}
                  </div>
                  <span className="font-bold text-gray-700 text-sm">{school.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-gray-600">{school.average}%</span>
                  <Link href={`/dashboard/admin`} className="p-1 neu-card rounded-lg text-blue-600">
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}