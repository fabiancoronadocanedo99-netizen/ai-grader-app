'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useNavigation } from '@/contexts/NavigationContext'

export default function NavigationBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { canGoBack, canGoForward, goBack, goForward } = useNavigation()

  const handleBack = () => {
    const targetPath = goBack();
    if (targetPath) {
      router.push(targetPath);
    }
  };

  const handleForward = () => {
    const targetPath = goForward();
    if (targetPath) {
      router.push(targetPath);
    }
  };

  const getBreadcrumb = () => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'Inicio';
    
    switch (segments[0]) {
      case 'login':
        return 'Iniciar Sesión';
      case 'dashboard':
        if (segments.length === 1) return 'Dashboard';
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
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Navegación Back/Forward */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleBack}
              disabled={!canGoBack}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 transition-colors duration-200"
              title="Regresar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleForward}
              disabled={!canGoForward}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 transition-colors duration-200"
              title="Avanzar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Breadcrumb */}
          <div className="flex-1 text-center">
            <span className="text-gray-700 font-medium text-lg">
              {getBreadcrumb()}
            </span>
          </div>

          {/* Espacio vacío donde estaba el toggle */}
          <div className="w-10"></div>
        </div>
      </div>
    </div>
  )
}