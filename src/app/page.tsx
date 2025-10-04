'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  useEffect(() => {
    // Simplemente redirige a la página de login por defecto
    router.push('/login')
  }, [router])

  return <p>Redirigiendo...</p>
}