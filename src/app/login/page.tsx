'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true) // Empezamos en estado de carga

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Si encontramos una sesión al cargar, nos vamos directo al dashboard
        router.push('/dashboard');
      } else {
        // Si no, terminamos de cargar y mostramos la página de login
        setLoading(false);
      }
    };

    checkSession();
  }, [router, supabase]);

  const handleLoginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`, // Esta parte es correcta y necesaria
      },
    });
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><p>Verificando sesión...</p></div>;
  }

  return (
    <div className="min-h-screen neu-container flex items-center justify-center p-4">
      <div className="w-full max-w-md neu-card p-8">
        <h2 className="text-3xl font-bold text-gray-700 mb-8 text-center">
          Iniciar Sesión
        </h2>
        {/* El formulario de email/pass lo quitamos por ahora para simplificar */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-400 opacity-30"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-gray-100 text-gray-500">o</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLoginWithGoogle}
          className="neu-button-white w-full text-gray-700 font-semibold py-4 px-6 flex items-center justify-center space-x-3"
        >
          {/* SVG de Google */}
          <span>Continuar con Google</span>
        </button>
      </div>
    </div>
  );
}