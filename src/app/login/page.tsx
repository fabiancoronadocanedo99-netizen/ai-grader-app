'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient' 

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false) 

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true) // Deshabilitar botón
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        alert(`Error: ${error.message}`)
      } else {
        // El login fue exitoso, redirigir
        router.push('/dashboard')
      }
    } catch (error) {
      alert(`Error inesperado: ${(error as Error).message}`)
    } finally {
      setLoading(false) 
    }
  }

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-200 rounded-xl p-8 shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff]">
        <h2 className="text-3xl font-bold text-gray-700 mb-8 text-center">
          Iniciar Sesión
        </h2>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-gray-200 border border-gray-300/50 rounded-lg p-4 shadow-inner-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff] text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-300/50 transition-all"
              placeholder="tu@email.com"
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-gray-200 border border-gray-300/50 rounded-lg p-4 shadow-inner-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff] text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-300/50 transition-all"
              placeholder="••••••••"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading} // Deshabilitar mientras carga
            className="w-full bg-gray-200 text-gray-700 font-semibold py-4 px-6 rounded-lg shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] hover:shadow-[6px_6px_12px_#d1d9e6,-6px_-6px_12px_#ffffff] active:shadow-inner-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Iniciando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}