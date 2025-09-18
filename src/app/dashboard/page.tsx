'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import CreateClassModal from '../../components/CreateClassModal'

interface Class {
  id: string
  name: string | null
  subject: string | null
  grade_level: string | null
  created_at: string
}

interface Profile {
  id: string
  profile_completed: boolean
}

export default function DashboardPage() {
  const router = useRouter()
  const [classes, setClasses] = useState<Class[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Estados para dropdown menu y eliminación
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [classToDelete, setClassToDelete] = useState<Class | null>(null)

  const fetchClasses = useCallback(async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error al cargar las clases:', error.message)
      alert(`Error al cargar las clases: ${error.message}`)
    } else {
      setClasses(data || [])
    }
  }, [])

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    
    if (error) {
      console.error('Error al cargar el perfil:', error.message)
    } else {
      setProfile(data)
    }
  }, [])

  useEffect(() => {
    const loadData = async () => {
      await fetchClasses()
      await fetchProfile()
      setLoading(false)
    }
    loadData()
  }, [fetchClasses, fetchProfile])

  return (
    <div className="min-h-screen neu-container p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-700 mb-2">
            Mis Clases
          </h1>
          <p className="text-gray-600">
            Gestiona tus clases y exámenes
          </p>
        </div>
        <button 
          onClick={() => {
            if (profile?.profile_completed) {
              setIsModalOpen(true)
            } else {
              router.push('/onboarding')
            }
          }}
          className="neu-button text-gray-700 font-semibold py-3 px-6"
        >
          Crear Nueva Clase
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-500 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">
              Cargando clases...
            </p>
          </div>
        </div>
      ) : classes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((classItem) => (
            <div
              key={classItem.id}
              className="neu-card p-6 transition-all duration-300 hover:transform hover:scale-105 flex flex-col justify-between"
            >
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                  {classItem.name || 'Clase sin nombre'}
                </h3>
                {classItem.subject && (
                  <div className="flex items-center mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                    <p className="text-gray-600 text-sm">
                      <span className="font-medium">Materia:</span> {classItem.subject}
                    </p>
                  </div>
                )}
                {classItem.grade_level && (
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    <p className="text-gray-600 text-sm">
                      <span className="font-medium">Nivel:</span> {classItem.grade_level}
                    </p>
                  </div>
                )}
              </div>
              <Link 
                href={`/dashboard/class/${classItem.id}`}
                className="neu-button text-gray-700 font-medium py-3 px-4 text-center block"
              >
                Ver Exámenes
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No tienes clases creadas aún
          </h3>
          <p className="text-gray-600 mb-6">
            ¡Crea tu primera clase para comenzar!
          </p>
          <button
            onClick={() => {
              if (profile?.profile_completed) {
                setIsModalOpen(true)
              } else {
                router.push('/onboarding')
              }
            }}
            className="neu-button text-gray-700 font-semibold py-3 px-6"
          >
            Crear Primera Clase
          </button>
        </div>
      )}
      
      {isModalOpen && (
        <CreateClassModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onClassCreated={fetchClasses}
        />
      )}
    </div>
  )
}