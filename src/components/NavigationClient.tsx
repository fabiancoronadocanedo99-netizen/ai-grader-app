'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, UserCircle, LogOut, ShieldCheck, School, Landmark } from 'lucide-react'
import { createClient } from '@/lib/supabaseClient'

type NavigationClientProps = {
  userRole?: string;
  userEmail?: string;
  userId?: string;
}

export default function NavigationClient({ 
  userRole: initialRole, 
  userEmail: initialEmail,
  userId // Recibimos el ID aunque no lo usemos visualmente por ahora
}: NavigationClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  // Estados con respaldo por si el servidor falla
  const [role, setRole] = useState(initialRole)
  const [email, setEmail] = useState(initialEmail)

  // RESPALDO: Si el servidor no mandó los datos, los buscamos directamente desde el cliente
  useEffect(() => {
    // Si ya tenemos los datos, no hacemos nada
    if (role && email) return;

    const loadProfileDirectly = async () => {
      try {
        // 1. Obtenemos el usuario directamente desde el navegador
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // 2. Buscamos su perfil en la tabla
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profile) {
            console.log("Perfil cargado desde el cliente:", profile.role);
            setRole(profile.role);
            setEmail(profile.email);
          }
        }
      } catch (error) {
        console.error("Error cargando perfil desde el navegador:", error);
      }
    };

    loadProfileDirectly();
  }, [role, email, supabase]);

  const handleBack = () => router.back()
  const handleForward = () => router.forward()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    // Forzamos una recarga completa del navegador para limpiar la memoria
    // Esto evita que datos de la sesión anterior persistan en el estado de React
    window.location.href = '/login'
  }

  // Lógica de botones simplificada y robusta con useMemo
  const adminConfig = useMemo(() => {
    if (!role) return null;

    if (role === 'superadmin') {
      return { href: '/admin', label: 'Super Admin', icon: <ShieldCheck className="w-4 h-4" /> };
    }
    if (role === 'admin') {
      return { href: '/dashboard/admin', label: 'Panel Escuela', icon: <School className="w-4 h-4" /> };
    }
    if (role === 'institutional_manager') {
      return { href: '/dashboard/institutional', label: 'Centro de Mando', icon: <Landmark className="w-4 h-4" /> };
    }

    return null;
  }, [role]);

  const getBreadcrumb = () => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'INICIO';
    const first = segments[0].toUpperCase();
    if (first === 'DASHBOARD' && segments[1] === 'INSTITUTIONAL') return 'CENTRO DE MANDO';
    return first;
  };

  return (
    <div className="sticky top-0 z-40 bg-[#e0e5ec] shadow-[inset_0_-2px_4px_rgba(184,193,206,0.3)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          <div className="flex items-center space-x-3 w-24">
            <button onClick={handleBack} className="neu-button p-2 text-gray-700 hover:text-blue-600 transition-all">
              <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
            </button>
            <button onClick={handleForward} className="neu-button p-2 text-gray-700 hover:text-blue-600 transition-all">
               <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex-1 text-center px-2">
            <span className="text-gray-700 font-black text-xs tracking-[0.3em] uppercase">
              {getBreadcrumb()}
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 min-w-[6rem]">

            {/* --- BLOQUE DE DEBUG (Bórralo después) --- */}
            <div className="absolute top-16 right-4 bg-black text-white text-[8px] p-2 rounded opacity-50 z-50">
              UID: {role ? 'Con Perfil' : 'SIN PERFIL'} | Email: {email || 'Nulo'}
            </div>

            {/* Email del Usuario */}
            {email && (
              <div className="hidden lg:flex items-center gap-2 text-[10px] font-bold text-gray-500 bg-[#e0e5ec] shadow-[inset_2px_2px_5px_#b8c1ce,inset_-2px_-2px_5px_#ffffff] px-3 py-1.5 rounded-full">
                <UserCircle className="w-3 h-3" />
                <span className="truncate max-w-[120px] uppercase tracking-wider">{email.split('@')[0]}</span>
              </div>
            )}

            {adminConfig && (
              <Link href={adminConfig.href}>
                <button className="neu-button px-4 py-2 flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest shadow-[4px_4px_10px_#b8c1ce,-4px_-4px_10px_#ffffff] active:shadow-[inset_2px_2px_5px_#b8c1ce,inset_-2px_-2px_5px_#ffffff]">
                  {adminConfig.icon}
                  <span className="hidden sm:inline">{adminConfig.label}</span>
                </button>
              </Link>
            )}

            <button 
              onClick={handleLogout}
              className="neu-button p-2.5 text-red-500 hover:text-red-600 shadow-[4px_4px_10px_#b8c1ce,-4px_-4px_10px_#ffffff] active:shadow-[inset_2px_2px_5px_#b8c1ce,inset_-2px_-2px_5px_#ffffff]"
            >
              <LogOut className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}