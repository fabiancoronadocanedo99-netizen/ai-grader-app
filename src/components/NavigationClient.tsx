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
    const syncUser = async () => {
      // 1. Obtener usuario directamente del sistema de Auth
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        console.log("Usuario Auth detectado:", user.email)
        setEmail(user.email || 'Usuario')

        // 2. Intentar obtener el rol de la tabla profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile) {
          console.log("Rol detectado:", profile.role)
          setRole(profile.role)
        }
      }
    }
    syncUser()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Definición de botones
  const adminBtn = role === 'superadmin' 
    ? { href: '/admin', label: 'SUPER', icon: <ShieldCheck size={14} /> }
    : role === 'admin'
    ? { href: '/dashboard/admin', label: 'ADMIN', icon: <School size={14} /> }
    : role === 'institutional_manager'
    ? { href: '/dashboard/institutional', label: 'MANDO', icon: <Landmark size={14} /> }
    : null

  return (
    <div className="sticky top-0 z-40 bg-[#e0e5ec] shadow-[inset_0_-2px_4px_rgba(184,193,206,0.3)] h-16 flex items-center px-4">

      {/* Izquierda: Flechas */}
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="neu-button p-2 text-gray-600"><ChevronLeft size={16} /></button>
        <button onClick={() => router.forward()} className="neu-button p-2 text-gray-600 hidden sm:block"><ChevronRight size={16} /></button>
      </div>

      {/* Centro: Título */}
      <div className="flex-1 text-center font-black text-[10px] tracking-[0.2em] text-gray-600 uppercase">
        {pathname.includes('institutional') ? 'CENTRO DE MANDO' : 'DASHBOARD'}
      </div>

      {/* Derecha: Datos de Usuario */}
      <div className="flex items-center gap-3">

        {/* Email - ¡Ahora sin condiciones de tamaño para que lo veas! */}
        {email && (
          <div className="flex items-center gap-2 text-[9px] font-bold text-gray-500 bg-[#e0e5ec] shadow-[inset_2px_2px_5px_#b8c1ce,inset_-2px_-2px_5px_#ffffff] px-3 py-1.5 rounded-full uppercase">
            <UserCircle size={12} /> {email.split('@')[0]}
          </div>
        )}

        {/* Botón Admin - Si el rol existe */}
        {adminBtn && (
          <Link href={adminBtn.href}>
            <button className="neu-button px-3 py-2 flex items-center gap-1 text-[9px] font-black text-blue-600 uppercase shadow-[4px_4px_10px_#b8c1ce,-4px_-4px_10px_#ffffff]">
              {adminBtn.icon} {adminBtn.label}
            </button>
          </Link>
        )}

        <button onClick={handleLogout} className="neu-button p-2 text-red-500 shadow-[4px_4px_10px_#b8c1ce,-4px_-4px_10px_#ffffff]">
          <LogOut size={16} />
        </button>
      </div>
    </div>
  )
}