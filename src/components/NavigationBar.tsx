'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useNavigation } from '@/contexts/NavigationContext'

export default function NavigationBar() {
  const supabase = createClient();
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
    <div className="sticky top-0 z-40 neu-container" style={{boxShadow: 'inset 0 -2px 4px rgba(184, 193, 206, 0.3)'}}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Navegación Back/Forward */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleBack}
              disabled={!canGoBack}
              className="neu-button p-2 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700"
              title="Regresar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleForward}
              disabled={!canGoForward}
              className="neu-button p-2 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700"
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

          {/* Espacio vacío para equilibrar */}
          <div className="w-24"></div>
        </div>
      </div>
    </div>
  )
}