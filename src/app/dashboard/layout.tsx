'use client'

import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useState } from 'react'
import CommandPalette from '@/components/CommandPalette' // <-- 1. Importar

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClientComponentClient()
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
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">AI Grader</h1>
        <div className="flex items-center gap-4">
          <span>{userEmail}</span>
          <button onClick={handleLogout} className="neu-button-white px-4 py-2">
            Cerrar Sesión
          </button>
        </div>
      </header>
      <main>{children}</main>
      <CommandPalette /> {/* <-- 2. Añadir aquí */}
    </div>
  )
}