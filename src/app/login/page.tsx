'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true) // Empezamos en estado de carga

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
      } else {
        setLoading(false);
      }
    };
    checkSession();
  }, [router, supabase]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else router.push('/dashboard');
  };

  const handleLoginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
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
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="neu-input w-full p-4"
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="neu-input w-full p-4"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="neu-button w-full text-gray-700 font-semibold py-4"
          >
            Iniciar Sesión
          </button>
        </form>
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300"></div></div>
          <div className="relative flex justify-center text-sm"><span className="px-2 bg-gray-100 text-gray-500">o</span></div>
        </div>
        <button
          type="button"
          onClick={handleLoginWithGoogle}
          className="neu-button-white w-full text-gray-700 font-semibold py-4 flex items-center justify-center space-x-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">{/* SVG de Google */}</svg>
          <span>Continuar con Google</span>
        </button>
      </div>
    </div>
  );
}