'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function HomePage() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    // Esta función se asegura de que la sesión se lea al cargar
    const checkInitialSession = async () => {
        await supabase.auth.getSession();
    };
    checkInitialSession();

    // Este "oyente" espera cualquier cambio en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // Si se detecta una sesión, redirige al dashboard
        console.log("Sesión detectada, redirigiendo a /dashboard...");
        router.push('/dashboard');
      } else {
        // Si no hay sesión, redirige al login
        console.log("No hay sesión, redirigiendo a /login...");
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