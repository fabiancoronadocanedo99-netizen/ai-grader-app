'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { LayoutDashboard, ChevronLeft, ChevronRight, UserCircle, LogOut, ShieldCheck, School, Landmark } from 'lucide-react'
import { createClient } from '@/lib/supabaseClient'

export default function NavigationClient() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [role, setRole] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const initAuth = async () => {
      // 1. Obtener email de Auth (Esto NO depende de la tabla profiles)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email || null)

        // 2. Intentar obtener el rol (Si falla, no bloqueamos la barra)
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          if (profile) setRole(profile.role)
        } catch (e) {
          console.error("Error silencioso cargando rol:", e)
        }
      }
    }
    initAuth()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const adminConfig = role === 'superadmin' 
    ? { href: '/admin', label: 'SUPER ADMIN', icon: <ShieldCheck className="w-4 h-4" /> }
    : role === 'admin'
    ? { href: '/dashboard/admin', label: 'ADMIN ESCUELA', icon: <School className="w-4 h-4" /> }
    : role === 'institutional_manager'
    ? { href: '/dashboard/institutional', label: 'CENTRO DE MANDO', icon: <Landmark className="w-4 h-4" /> }
    : null

  return (
    <div className="sticky top-0 z-40 bg-[#e0e5ec] shadow-[inset_0_-2px_4px_rgba(184,193,206,0.3)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">

        <div className="flex items-center space-x-3">
          <button onClick={() => router.back()} className="neu-button p-2 text-gray-700 hover:text-blue-600"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => router.forward()} className="neu-button p-2 text-gray-700 hover:text-blue-600"><ChevronRight className="w-4 h-4" /></button>
        </div>

        <div className="text-gray-700 font-black text-[10px] tracking-[0.3em] uppercase">
          {pathname.includes('institutional') ? 'CENTRO DE MANDO' : 'DASHBOARD'}
        </div>

        <div className="flex items-center gap-3">
          {email && (
            <div className="hidden md:flex items-center gap-2 text-[10px] font-bold text-gray-500 bg-[#e0e5ec] shadow-[inset_2px_2px_5px_#b8c1ce,inset_-2px_-2px_5px_#ffffff] px-3 py-1.5 rounded-full uppercase">
              <UserCircle className="w-3 h-3" /> {email.split('@')[0]}
            </div>
          )}

          {adminConfig && (
            <Link href={adminConfig.href}>
              <button className="neu-button px-4 py-2 flex items-center gap-2 text-[10px] font-black text-blue-600 shadow-[4px_4px_10px_#b8c1ce,-4px_-4px_10px_#ffffff]">
                {adminConfig.icon} {adminConfig.label}
              </button>
            </Link>
          )}

          <button onClick={handleLogout} className="neu-button p-2.5 text-red-500 shadow-[4px_4px_10px_#b8c1ce,-4px_-4px_10px_#ffffff]"><LogOut className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  )
}