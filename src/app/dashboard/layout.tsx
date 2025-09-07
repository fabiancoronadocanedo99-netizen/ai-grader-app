'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import React, { useState, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js' // Importar el tipo de dato 'User'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null); // Estado para guardar la información del usuario
  const [loading, setLoading] = useState(true);

  // Función para obtener los datos del usuario actual
  const getUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
    } else {
      // Si no hay usuario, redirigir al login
      router.push('/login');
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    getUser();
  }, [getUser]);

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Mostrar un estado de carga mientras se obtienen los datos del usuario
  if (loading) {
    return (
      <div className="bg-gray-200 min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-200 min-h-screen">
      {/* Header con diseño Neumórfico */}
      <header className="bg-gray-200 p-4 shadow-[6px_6px_12px_#d1d9e6,-6px_-6px_12px_#ffffff]">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="text-xl font-bold text-gray-700">
            AI Grader
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Mostrar el email real del usuario */}
            <span className="text-gray-600 text-sm hidden sm:block">
              {user?.email || 'Cargando...'}
            </span>
            <button
              onClick={handleLogout}
              className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff] hover:shadow-[3px_3px_6px_#d1d9e6,-3px_-3px_6px_#ffffff] active:shadow-inner-[2px_2px_4px_#d1d9e6,-2px_-2px_4px_#ffffff] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* Contenido principal de la página */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}