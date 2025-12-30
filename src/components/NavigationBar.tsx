'use client'

import { useRouter, usePathname } from 'next/navigation'
// CORRECCIÓN: Importamos directamente de la librería que instalaste
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LayoutDashboard, ChevronLeft, ChevronRight } from 'lucide-react'

export default function NavigationBar() {
  // CORRECCIÓN: Usamos el hook de la librería
  const supabase = createClientComponentClient();

  const router = useRouter()
  const pathname = usePathname()

  // Estado para guardar el rol del usuario
  const [userRole, setUserRole] = useState<string | null>(null);

  // Efecto para obtener el perfil y el rol
  useEffect(() => {
    const getUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile) {
          setUserRole(profile.role);
        }
      }
    };
    getUserRole();
  }, [supabase]);

  // Funciones de navegación usando router nativo
  const handleBack = () => {
    router.back();
  };

  const handleForward = () => {
    router.forward();
  };

  const getBreadcrumb = () => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'Inicio';

    switch (segments[0]) {
      case 'login':
        return 'Iniciar Sesión';
      case 'dashboard':
        if (segments.length === 1) return 'Dashboard';
        if (segments[1] === 'admin') return 'Administración';
        if (segments[1] === 'class' && segments[2]) {
          if (segments.length === 3) return `Clase`;
          if (segments[3] === 'exam' && segments[4]) {
            return `Clase > Examen`;
          }
        }
        return 'Dashboard';
      default:
        return 'Página';
    }
  };

  return (
    <div className="sticky top-0 z-40 neu-container" style={{boxShadow: 'inset 0 -2px 4px rgba(184, 193, 206, 0.3)'}}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Navegación Back/Forward */}
          <div className="flex items-center space-x-3 w-24"> 
            <button
              onClick={handleBack}
              className="neu-button p-2 text-gray-700 hover:text-blue-600 transition-colors active:scale-95"
              title="Regresar"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
            </button>
            <button
              onClick={handleForward}
              className="neu-button p-2 text-gray-700 hover:text-blue-600 transition-colors active:scale-95"
              title="Avanzar"
            >
               <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>

          {/* Breadcrumb */}
          <div className="flex-1 text-center">
            <span className="text-gray-700 font-medium text-lg truncate">
              {getBreadcrumb()}
            </span>
          </div>

          {/* Área derecha: Botón Admin o Espacio vacío */}
          <div className="flex items-center justify-end w-auto min-w-[6rem]">
            {userRole === 'admin' ? (
              <Link href="/dashboard/admin">
                <button 
                  className="neu-button px-4 py-2 flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Panel Admin</span>
                  <span className="sm:hidden">Admin</span>
                </button>
              </Link>
            ) : (
              <div className="w-24"></div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}