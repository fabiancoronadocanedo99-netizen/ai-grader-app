'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function HomePage() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // Si se detecta una sesión (incluso si llega un poco tarde), redirige al dashboard
        router.push('/dashboard');
      } else {
        // Si no hay sesión o el usuario cierra sesión, redirige al login
        router.push('/login');
      }
    });

    // Limpiar el "oyente" cuando el componente se desmonte
    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  // Muestra un mensaje de "Cargando..." mientras se espera el evento
  return (
    <div className="flex h-screen items-center justify-center">
      <p>Verificando autenticación...</p>
    </div>
  );
}