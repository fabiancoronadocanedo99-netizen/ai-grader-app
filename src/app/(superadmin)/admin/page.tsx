'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseClient'
import Link from 'next/link'

export default function SuperAdminDashboard() {
  const supabase = createClient()

  // Estados para los conteos
  const [orgCount, setOrgCount] = useState<number>(0)
  const [profileCount, setProfileCount] = useState<number>(0)
  const [gradeCount, setGradeCount] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)

        // Ejecutamos las 3 consultas en paralelo para mayor velocidad
        const [orgs, profiles, grades] = await Promise.all([
          supabase.from('organizations').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('grades').select('*', { count: 'exact', head: true })
        ])

        if (orgs.count !== null) setOrgCount(orgs.count)
        if (profiles.count !== null) setProfileCount(profiles.count)
        if (grades.count !== null) setGradeCount(grades.count)

      } catch (error) {
        console.error('Error al cargar estadísticas:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [supabase])

  // Clases CSS reutilizables para el estilo Neumórfico
  const neuBase = "bg-[#e0e5ec] text-gray-700"
  const neuShadow = "shadow-[9px_9px_16px_rgb(163,177,198),-9px_-9px_16px_rgba(255,255,255,0.5)]"
  const neuInset = "shadow-[inset_6px_6px_10px_rgb(163,177,198),inset_-6px_-6px_10px_rgba(255,255,255,0.5)]"

  const neuCard = `${neuBase} ${neuShadow} rounded-2xl`
  const neuButton = `${neuBase} ${neuShadow} px-6 py-3 rounded-xl font-semibold hover:translate-y-[2px] active:shadow-[inset_6px_6px_10px_rgb(163,177,198),inset_-6px_-6px_10px_rgba(255,255,255,0.5)] transition-all duration-200 flex items-center gap-2`

  if (loading) {
    return (
      <div className={`min-h-screen ${neuBase} flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-gray-400"></div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${neuBase} flex font-sans`}>

      {/* --- BARRA LATERAL (Sidebar) --- */}
      <aside className={`w-1/5 p-6 flex flex-col gap-8 z-10 sticky top-0 h-screen border-r border-gray-300/20`}>
        <div className="mb-4 px-2">
          <h1 className="text-2xl font-bold text-gray-800 tracking-wide">
            Super<span className="text-blue-600">Admin</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">Panel de Control</p>
        </div>

        <nav className="flex flex-col gap-4">
          <Link href="/dashboard" className={`${neuButton} text-blue-600`}>
            <span>📊</span> Dashboard
          </Link>

          {/* 🔥 CORRECCIÓN: Enlace actualizado para apuntar a /admin/organizations */}
          <Link href="/admin/organizations" className={neuButton}>
            <span>🏢</span> Organizaciones
          </Link>

          {/* 🔥 CORRECCIÓN: Enlace actualizado para apuntar a /admin/users */}
          <Link href="/admin/users" className={neuButton}>
            <span>👥</span> Usuarios
          </Link>

          <Link href="/admin/settings" className={neuButton}>
            <span>⚙️</span> Configuración
          </Link>
        </nav>

        <div className="mt-auto">
           {/* Botón extra decorativo o logout */}
           <div className={`${neuCard} p-4 text-center text-sm`}>
             <p>Admin Conectado</p>
             <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mt-2 shadow-[0_0_10px_#22c55e]"></div>
           </div>
        </div>
      </aside>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <main className="flex-1 p-10 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <h2 className="text-3xl font-bold text-gray-700">Resumen General</h2>
          <div className={`${neuCard} w-12 h-12 flex items-center justify-center rounded-full`}>
            👤
          </div>
        </header>

        {/* Grid de KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">

          {/* Tarjeta KPI: Organizaciones */}
          <div className={`${neuCard} p-8 flex flex-col items-center justify-center transform hover:scale-[1.02] transition-transform`}>
            <div className="text-4xl mb-4">🏢</div>
            <h3 className="text-gray-500 font-medium mb-2">Total Organizaciones</h3>
            <span className="text-4xl font-extrabold text-gray-800">{orgCount}</span>
          </div>

          {/* Tarjeta KPI: Usuarios */}
          <div className={`${neuCard} p-8 flex flex-col items-center justify-center transform hover:scale-[1.02] transition-transform`}>
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-gray-500 font-medium mb-2">Total Usuarios</h3>
            <span className="text-4xl font-extrabold text-blue-600">{profileCount}</span>
          </div>

          {/* Tarjeta KPI: Evaluaciones */}
          <div className={`${neuCard} p-8 flex flex-col items-center justify-center transform hover:scale-[1.02] transition-transform`}>
            <div className="text-4xl mb-4">📝</div>
            <h3 className="text-gray-500 font-medium mb-2">Total Evaluaciones</h3>
            <span className="text-4xl font-extrabold text-green-600">{gradeCount}</span>
          </div>

        </div>

        {/* Sección de Actividad Reciente */}
        <section className={`${neuCard} p-8 min-h-[400px]`}>
          <div className="flex justify-between items-center mb-6 border-b border-gray-300/30 pb-4">
            <h2 className="text-xl font-bold text-gray-700">Actividad Reciente</h2>
            <button className={`${neuButton} text-xs px-3 py-1`}>Ver Todo</button>
          </div>

          {/* Placeholder para contenido futuro */}
          <div className={`w-full h-64 ${neuInset} rounded-xl flex items-center justify-center flex-col gap-4 text-gray-400`}>
             <span className="text-5xl">📉</span>
             <p className="font-medium">Aquí irán las tablas y gráficos de actividad</p>
          </div>
        </section>

      </main>
    </div>
  )
}