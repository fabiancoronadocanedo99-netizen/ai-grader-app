'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigation } from '@/contexts/NavigationContext';

export default function NavigationBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { canGoBack, canGoForward, goBack, goForward } = useNavigation();

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
    <div className="sticky top-0 z-40 bg-gray-200/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-300/50 dark:border-gray-600/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Navegación Back/Forward */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleBack}
              disabled={!canGoBack}
              className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#1a1a1a,-4px_-4px_8px_#404040] disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 hover:shadow-[2px_2px_4px_#d1d9e6,-2px_-2px_4px_#ffffff] dark:hover:shadow-[2px_2px_4px_#1a1a1a,-2px_-2px_4px_#404040] transition-all duration-200"
              title="Regresar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleForward}
              disabled={!canGoForward}
              className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#1a1a1a,-4px_-4px_8px_#404040] disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 hover:shadow-[2px_2px_4px_#d1d9e6,-2px_-2px_4px_#ffffff] dark:hover:shadow-[2px_2px_4px_#1a1a1a,-2px_-2px_4px_#404040] transition-all duration-200"
              title="Avanzar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Breadcrumb */}
          <div className="flex-1 text-center">
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              {getBreadcrumb()}
            </span>
          </div>

          {/* Toggle Día/Noche */}
          <div className="flex items-center">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#1a1a1a,-4px_-4px_8px_#404040] text-slate-700 dark:text-slate-300 hover:shadow-[2px_2px_4px_#d1d9e6,-2px_-2px_4px_#ffffff] dark:hover:shadow-[2px_2px_4px_#1a1a1a,-2px_-2px_4px_#404040] transition-all duration-200"
              title={theme === 'light' ? 'Cambiar a modo nocturno' : 'Cambiar a modo día'}
            >
              {theme === 'light' ? (
                // Icono de luna (modo nocturno)
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              ) : (
                // Icono de sol (modo día)
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}