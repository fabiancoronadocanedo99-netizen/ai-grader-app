'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, ChevronLeft, ChevronRight, UserCircle } from 'lucide-react'

type NavigationClientProps = {
  userRole?: string;
  userEmail?: string;
}

export default function NavigationClient({ userRole, userEmail }: NavigationClientProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleBack = () => router.back()
  const handleForward = () => router.forward()

  // --- DEBUG EN CONSOLA DEL NAVEGADOR ---
  console.log("=== DEBUG NAVBAR CLIENT ===");
  console.log("Rol recibido:", userRole);
  console.log("Email recibido:", userEmail);
  console.log("===========================");

  const getBreadcrumb = () => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'Inicio';

    switch (segments[0]) {
      case 'login': return 'Iniciar Sesión';
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
      default: return 'Página';
    }
  };

  return (
    <div className="sticky top-0 z-40 neu-container" style={{boxShadow: 'inset 0 -2px 4px rgba(184, 193, 206, 0.3)'}}>

      {/* --- CHIVATO VISUAL (BORRAR LUEGO) --- */}
      <div className="fixed bottom-4 right-4 bg-black text-white p-4 z-50 text-xs font-mono rounded shadow-lg opacity-80 pointer-events-none">
        DEBUG INFO:<br/>
        Role: {userRole ? `"${userRole}"` : "UNDEFINED"}<br/>
        Email: {userEmail || "NO EMAIL"}
      </div>
      {/* ----------------------------------- */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          <div className="flex items-center space-x-3 w-24">
            <button onClick={handleBack} className="neu-button p-2 text-gray-700 hover:text-blue-600 active:scale-95">
              <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
            </button>
            <button onClick={handleForward} className="neu-button p-2 text-gray-700 hover:text-blue-600 active:scale-95">
               <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex-1 text-center px-2">
            <span className="text-gray-700 font-medium text-lg truncate block">
              {getBreadcrumb()}
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 w-auto min-w-[6rem]">
            {userEmail && (
              <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 mr-2 bg-gray-200/50 px-3 py-1 rounded-full">
                <UserCircle className="w-3 h-3" />
                <span className="truncate max-w-[150px]">{userEmail}</span>
              </div>
            )}

            {/* LÓGICA DEL BOTÓN */}
            {userRole === 'admin' ? (
              <Link href="/dashboard/admin">
                <button className="neu-button px-4 py-2 flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Panel Admin</span>
                  <span className="sm:hidden">Admin</span>
                </button>
              </Link>
            ) : (
              <div className="w-4"></div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}