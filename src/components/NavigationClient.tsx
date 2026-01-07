'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, ChevronLeft, ChevronRight, UserCircle, LogOut, ShieldCheck, School } from 'lucide-react'
import { createClient } from '@/lib/supabaseClient'

type NavigationClientProps = {
  userRole?: string;
  userEmail?: string;
}

export default function NavigationClient({ userRole, userEmail }: NavigationClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const handleBack = () => router.back()
  const handleForward = () => router.forward()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Lógica para definir el destino y texto del botón de administración
  const getAdminButtonConfig = () => {
    if (userRole === 'superadmin') {
      return {
        href: '/admin',
        label: 'Super Admin',
        icon: <ShieldCheck className="w-4 h-4" />
      }
    }
    if (userRole === 'admin') {
      return {
        href: '/dashboard/admin',
        label: 'Panel Escuela',
        icon: <School className="w-4 h-4" />
      }
    }
    return null
  }

  const adminConfig = getAdminButtonConfig()

  const getBreadcrumb = () => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'Inicio';

    switch (segments[0]) {
      case 'login': return 'Iniciar Sesión';
      case 'admin':
        if (segments[1] === 'organizations') {
            if (segments[2]) return 'Admin > Organización';
            return 'Admin > Organizaciones';
        }
        if (segments[1] === 'users') return 'Admin > Usuarios';
        return 'Administración Global';
      case 'dashboard':
        if (segments.length === 1) return 'Dashboard';
        if (segments[1] === 'admin') return 'Gestión Escuela';
        if (segments[1] === 'class' && segments[2]) {
          if (segments.length === 3) return `Clase`;
          if (segments[3] === 'exam' && segments[4]) {
            return `Clase > Examen`;
          }
        }
        return 'Dashboard';
      default: return 'Página';
    }
  };

  return (
    <div className="sticky top-0 z-40 bg-[#e0e5ec]" style={{boxShadow: 'inset 0 -2px 4px rgba(184, 193, 206, 0.3)'}}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Navegación Back/Forward */}
          <div className="flex items-center space-x-3 w-24">
            <button onClick={handleBack} className="neu-button p-2 text-gray-700 hover:text-blue-600 active:scale-95 transition-all">
              <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
            </button>
            <button onClick={handleForward} className="neu-button p-2 text-gray-700 hover:text-blue-600 active:scale-95 transition-all">
               <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>

          {/* Breadcrumb */}
          <div className="flex-1 text-center px-2">
            <span className="text-gray-700 font-bold text-lg truncate block">
              {getBreadcrumb()}
            </span>
          </div>

          {/* Área derecha: Info Usuario, Admin y Logout */}
          <div className="flex items-center justify-end gap-3 w-auto min-w-[6rem]">

            {/* Email del Usuario */}
            {userEmail && (
              <div className="hidden lg:flex items-center gap-2 text-[10px] font-bold text-gray-500 bg-[#e0e5ec] shadow-[inset_2px_2px_5px_#b8c1ce,inset_-2px_-2px_5px_#ffffff] px-3 py-1.5 rounded-full">
                <UserCircle className="w-3 h-3" />
                <span className="truncate max-w-[120px] uppercase tracking-wider">{userEmail.split('@')[0]}</span>
              </div>
            )}

            {/* BOTÓN DE ADMINISTRACIÓN INTELIGENTE */}
            {adminConfig && (
              <Link href={adminConfig.href}>
                <button className="neu-button px-4 py-2 flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors shadow-[4px_4px_10px_#b8c1ce,-4px_-4px_10px_#ffffff] active:shadow-[inset_2px_2px_5px_#b8c1ce,inset_-2px_-2px_5px_#ffffff]">
                  {adminConfig.icon}
                  <span className="hidden sm:inline uppercase tracking-tight">{adminConfig.label}</span>
                  <span className="sm:hidden">Admin</span>
                </button>
              </Link>
            )}

            {/* Botón Salir */}
            <button 
              onClick={handleLogout}
              className="neu-button p-2.5 text-red-500 hover:text-red-600 active:scale-95 transition-all shadow-[4px_4px_10px_#b8c1ce,-4px_-4px_10px_#ffffff] active:shadow-[inset_2px_2px_5px_#b8c1ce,inset_-2px_-2px_5px_#ffffff]"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}