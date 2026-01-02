'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import { useEffect, useState } from 'react'
import CommandPalette from '@/components/CommandPalette'
// 1. IMPORTANTE: Importamos nuestra barra de navegación
import NavigationBar from '@/components/NavigationBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || null)
      } else {
        router.push('/login')
      }
    }
    getUser()
  }, [supabase, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#e0e5ec]"> {/* Ajusté el fondo al color neumórfico */}

      {/* Header Superior (Logo y Logout) */}
      <header className="bg-[#e0e5ec] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] p-4 flex justify-between items-center relative z-50">
        <h1 className="text-xl font-bold text-slate-700">AI Grader</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600 hidden sm:inline">{userEmail}</span>
          <button 
            onClick={handleLogout} 
            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-[#e0e5ec] shadow-[5px_5px_10px_#b8b9be,-5px_-5px_10px_#ffffff] hover:text-red-500 active:shadow-[inset_3px_3px_6px_#b8b9be,inset_-3px_-3px_6px_#ffffff] transition-all"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* 2. AQUÍ INSERTAMOS LA BARRA DE NAVEGACIÓN (Con el botón de Admin) */}
      <NavigationBar />

      <main className="p-6">
        {children}
      </main>

      <CommandPalette />
    </div>
  )
}