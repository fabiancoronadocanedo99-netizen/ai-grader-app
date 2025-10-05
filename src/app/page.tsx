'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const supabase = createClient();
  const router = useRouter()
  useEffect(() => {
    router.push('/login')
  }, [router])

  return <p>Redirigiendo...</p>
}