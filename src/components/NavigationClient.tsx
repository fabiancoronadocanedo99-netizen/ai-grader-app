'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, UserCircle, LogOut, ShieldCheck, School, Landmark } from 'lucide-react'
import { createClient } from '@/lib/supabaseClient'

export default function NavigationClient() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [role, setRole] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const getIdentity = async () => {
      // 1. Obtener email directamente de la sesión (Esto no puede fallar)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email || null)

        // 2. Obtener el rol (Ahora la política es 'true', así que cargará rápido)
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile) setRole(profile.role)
      }
    }
    getIdentity()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Configuración de botones por rol
  const adminBtn = role === 'superadmin' 
    ? { href: '/admin', label: 'SUPER ADMIN', icon: <ShieldCheck size={16} /> }
    : role === 'admin'
    ? { href: '/dashboard/admin', label: 'ADMIN ESCUELA', icon: <School size={16} /> }
    : role === 'institutional_manager'
    ? { href: '/dashboard/institutional', label: 'CENTRO DE MANDO', icon: <Landmark size={16} /> }
    : null

  return (
    <div className="sticky top-0 z-40 bg-[#e0e5ec] shadow-[inset_0_-2px_4px_rgba(184,193,206,0.3)] h-16 flex items-center px-4 md:px-8">
      <div className="flex items-center space-x-3">
        <button onClick={() => router.back()} className="neu-button p-2 text-gray-600"><ChevronLeft size={16} /></button>
        <button onClick={() => router.forward()} className="neu-button p-2 text-gray-600"><ChevronRight size={16} /></button>
      </div>

      <div className="flex-1 text-center text-gray-600 font-black text-[10px] tracking-[0.3em] uppercase">
        {pathname.includes('institutional') ? 'CENTRO DE MANDO' : 'DASHBOARD'}
      </div>

      <div className="flex items-center gap-3">
        {email && (
          <div className="hidden lg:flex items-center gap-2 text-[10px] font-bold text-gray-500 bg-[#e0e5ec] shadow-[inset_2px_2px_5px_#b8c1ce,inset_-2px_-2px_5px_#ffffff] px-3 py-1.5 rounded-full uppercase">
            <UserCircle size={12} /> {email.split('@')[0]}
          </div>
        )}

        {adminBtn && (
          <Link href={adminBtn.href}>
            <button className="neu-button px-4 py-2 flex items-center gap-2 text-[10px] font-black text-blue-600 shadow-[4px_4px_10px_#b8c1ce,-4px_-4px_10px_#ffffff] active:shadow-[inset_2px_2px_5px_#b8c1ce]">
              {adminBtn.icon} {adminBtn.label}
            </button>
          </Link>
        )}

        <button onClick={handleLogout} className="neu-button p-2.5 text-red-500 shadow-[4px_4px_10px_#b8c1ce,-4px_-4px_10px_#ffffff] active:shadow-[inset_2px_2px_5px_#b8c1ce]">
          <LogOut size={16} />
        </button>
      </div>
    </div>
  )
}