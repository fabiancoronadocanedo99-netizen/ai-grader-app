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
      <div className="neu-container min-h-screen flex items-center justify-center">
        <p className="text-gray-700">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="neu-container min-h-screen">
      {/* Header con diseño Neumórfico */}
      <header className="neu-container p-4" style={{boxShadow: 'inset 0 2px 4px rgba(184, 193, 206, 0.3)'}}>
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
              className="neu-button text-gray-700 font-semibold py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
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