'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CreateClassModal from '@/components/CreateClassModal' // <-- ¡IMPORTANTE! Importamos el modal

// Definimos los tipos aquí
interface Class {
  id: string
  name: string
  created_at: string
}

interface Profile {
  id: string
  role: string
}

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<Class[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error("Error fetching classes:", error)
      alert("No se pudieron cargar las clases.")
      return
    }
    setClasses(data)
  }

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', user.id)
          .single()

        // --- Redirección por Rol ---
        if (profileData?.role === 'superadmin') {
          router.push('/admin')
          return
        }
        setProfile(profileData)
        await fetchClasses()
      }

      setLoading(false)
    }
    fetchInitialData()
  }, [supabase, router])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-800">Mis Clases</h1>
          <p className="text-gray-500">Gestiona tus clases y evaluaciones</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="neu-button px-6 py-3 font-semibold"
        >
          Crear Nueva Clase
        </button>
      </div>

      {classes.length === 0 ? (
        <div className="text-center py-20 neu-card">
          <h2 className="text-2xl font-semibold mb-2">No tienes clases creadas aún</h2>
          <p className="text-gray-600 mb-6">¡Crea tu primera clase para comenzar!</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="neu-button-primary px-8 py-3 font-bold"
          >
            Crear Primera Clase
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {classes.map((clase) => (
            <div key={clase.id} className="neu-card p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">{clase.name}</h3>
                <p className="text-sm text-gray-500">Sin materia</p> 
              </div>
              <Link href={`/dashboard/class/${clase.id}`} passHref>
                <div className="neu-button-white mt-6 text-center py-2 font-semibold cursor-pointer">
                  Ver Exámenes
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* --- ¡IMPORTANTE! Aquí llamamos al componente modal --- */}
      <CreateClassModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onClassCreated={() => {
          fetchClasses() // Recargamos la lista cuando se crea una nueva
        }}
      />
    </div>
  )
}