'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { LayoutDashboard, ChevronLeft, ChevronRight, UserCircle, LogOut, ShieldCheck, School, Landmark } from 'lucide-react'
import { createClient } from '@/lib/supabaseClient'

export default function NavigationClient({ userRole: initialRole, userEmail: initialEmail }: any) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [role, setRole] = useState(initialRole)
  const [email, setEmail] = useState(initialEmail)

  useEffect(() => {
    const loadData = async () => {
      // 1. Ver si Supabase reconoce al usuario
      const { data: { user } } = await supabase.auth.getUser()
      console.log("DEBUG - Usuario Auth:", user?.email)

      if (user) {
        // 2. Ver si el perfil existe en la tabla
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profile) {
          console.log("DEBUG - Perfil Encontrado. Rol:", profile.role)
          setRole(profile.role)
          setEmail(profile.email)
        } else {
          console.log("DEBUG - Error: Perfil no existe en la tabla profiles", error)
        }
      } else {
        console.log("DEBUG - Error: No hay sesión de Auth activa")
      }
    }
    loadData()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // LOGICA DE BOTONES
  const adminConfig = role === 'superadmin' 
    ? { href: '/admin', label: 'Super Admin', icon: <ShieldCheck className="w-4 h-4" /> }
    : role === 'admin'
    ? { href: '/dashboard/admin', label: 'Panel Escuela', icon: <School className="w-4 h-4" /> }
    : role === 'institutional_manager'
    ? { href: '/dashboard/institutional', label: 'Centro de Mando', icon: <Landmark className="w-4 h-4" /> }
    : null

  return (
    <div className="sticky top-0 z-40 bg-[#e0e5ec] shadow-[inset_0_-2px_4px_rgba(184,193,206,0.3)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Navegación Izquierda */}
          <div className="flex items-center space-x-3 w-24">
            <button onClick={() => router.back()} className="neu-button p-2 text-gray-700 hover:text-blue-600"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => router.forward()} className="neu-button p-2 text-gray-700 hover:text-blue-600"><ChevronRight className="w-4 h-4" /></button>
          </div>

          {/* Breadcrumb Central */}
          <div className="flex-1 text-center">
            <span className="text-gray-700 font-black text-xs tracking-[0.3em] uppercase">
              {pathname.includes('institutional') ? 'CENTRO DE MANDO' : 'DASHBOARD'}
            </span>
          </div>

          {/* Área Derecha (LA QUE FALLA) */}
          <div className="flex items-center justify-end gap-3 min-w-[10rem]">

            {/* Si no hay email, mostramos un aviso de debug */}
            {!email && <span className="text-[8px] text-red-400 animate-pulse">Buscando sesión...</span>}

            {email && (
              <div className="hidden lg:flex items-center gap-2 text-[10px] font-bold text-gray-500 bg-[#e0e5ec] shadow-[inset_2px_2px_5px_#b8c1ce,inset_-2px_-2px_5px_#ffffff] px-3 py-1.5 rounded-full">
                <UserCircle className="w-3 h-3" />
                <span className="truncate max-w-[100px] uppercase">{email.split('@')[0]}</span>
              </div>
            )}

            {adminConfig && (
              <Link href={adminConfig.href}>
                <button className="neu-button px-4 py-2 flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase shadow-[4px_4px_10px_#b8c1ce,-4px_-4px_10px_#ffffff]">
                  {adminConfig.icon}
                  <span className="hidden sm:inline">{adminConfig.label}</span>
                </button>
              </Link>
            )}

            <button onClick={handleLogout} className="neu-button p-2.5 text-red-500"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  )
}