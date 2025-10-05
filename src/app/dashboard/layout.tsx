'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient' // <-- 1. CAMBIO IMPORTANTE
import { useEffect, useState } from 'react'
import CommandPalette from '@/components/CommandPalette'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient() // <-- 2. CAMBIO IMPORTANTE
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
      <CommandPalette />
    </div>
  )
}