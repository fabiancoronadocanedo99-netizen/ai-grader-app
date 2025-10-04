'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function HomePage() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // Si hay una sesión, redirige al dashboard
        router.push('/dashboard')
      } else {
        // Si no hay sesión, redirige al login
        router.push('/login')
      }
    }

    checkSession()
  }, [router, supabase])

  // Muestra un mensaje de "Cargando..." mientras se verifica la sesión
  return (
    <div className="flex h-screen items-center justify-center">
      <p>Redirigiendo...</p>
    </div>
  )
}