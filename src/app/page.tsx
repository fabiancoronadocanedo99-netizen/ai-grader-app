'use client' // Es importante que sea de cliente para usar el router

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Simplemente redirige a la página de login, que se encargará de la lógica de sesión
    router.push('/login')
  }, [router])

  // Muestra un mensaje mientras redirige
  return (
    <div className="flex h-screen items-center justify-center">
      <p>Redirigiendo a la página de inicio de sesión...</p>
    </div>
  )
}