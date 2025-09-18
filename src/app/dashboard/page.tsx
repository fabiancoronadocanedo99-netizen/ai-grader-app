'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import CreateClassModal from '@/components/CreateClassModal' // Corregido: Usar el alias

// Corregido: Los IDs de la base de datos son números
interface Class {
  id: number;
  subject?: string;
  grade_level?: string;
  name?: string;
}

interface Profile {
  id: string;
  profile_completed?: boolean;
  // Agregar otros campos del perfil según sea necesario
}

export default function DashboardPage() {
  const router = useRouter()
  const [classes, setClasses] = useState<Class[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Usar useCallback para evitar re-creaciones innecesarias de la función
  const fetchClasses = useCallback(async () => {
    // No necesitamos el bloque try/catch aquí, el manejo de errores de Supabase es suficiente
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('created_at', { ascending: false }); // Ordenar para ver las más nuevas primero
    
    if (error) {
      console.error('Error al cargar las clases:', error.message)
      alert(`Error al cargar las clases: ${error.message}`);
    } else {
      setClasses(data || [])
    }
  }, []); // El array de dependencias vacío significa que la función solo se crea una vez

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle() // Permite que no exista el perfil para usuarios nuevos
    
    if (error) {
      console.error('Error al cargar el perfil:', error.message)
    } else {
      setProfile(data) // data será null si no existe el perfil
    }
  }, [])

  useEffect(() => {
    const loadData = async () => {
      await fetchClasses()
      await fetchProfile()
      setLoading(false)
    }
    loadData()
  }, [fetchClasses, fetchProfile]) // Ejecutar el efecto cuando las funciones se definen

  return (
    <div className="min-h-screen transition-colors duration-300">
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-700 dark:text-white mb-2">
              Mis Clases
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
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
            className="btn-primary font-semibold py-3 px-6 rounded-xl"
          >
            Crear Nueva Clase
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300 text-lg">
                Cargando clases...
              </p>
            </div>
          </div>
        ) : classes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((classItem) => (
              <div
                key={classItem.id}
                className="card p-6 transition-all duration-300 flex flex-col justify-between group"
              >
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors duration-200">
                    {classItem.name || 'Clase sin nombre'}
                  </h3>
                  {classItem.subject && (
                    <div className="flex items-center mb-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                      <p className="text-gray-600 dark:text-gray-300 text-sm">
                        <span className="font-medium">Materia:</span> {classItem.subject}
                      </p>
                    </div>
                  )}
                  {classItem.grade_level && (
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-violet-500 rounded-full mr-3"></div>
                      <p className="text-gray-600 dark:text-gray-300 text-sm">
                        <span className="font-medium">Nivel:</span> {classItem.grade_level}
                      </p>
                    </div>
                  )}
                </div>
                <Link 
                  href={`/dashboard/class/${classItem.id}`}
                  className="w-full btn-primary font-medium py-3 px-4 rounded-lg block text-center"
                >
                  Ver Exámenes
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-white mb-2">
              No tienes clases creadas aún
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
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
              className="btn-primary font-semibold py-3 px-6 rounded-xl"
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
    </div>
  )
}