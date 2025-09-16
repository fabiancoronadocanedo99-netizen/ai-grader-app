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
      .single()
    
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
  }, [fetchClasses, fetchProfile]) // Ejecutar el efecto cuando las funciones se definen

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-700">
          Mis Clases
        </h1>
        <button 
          onClick={() => {
            if (profile?.profile_completed) {
              setIsModalOpen(true)
            } else {
              router.push('/onboarding')
            }
          }}
          className="bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl shadow-[6px_6px_12px_#d1d9e6,-6px_-6px_12px_#ffffff] hover:shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff] active:shadow-inner-[2px_2px_4px_#d1d9e6,-2px_-2px_4px_#ffffff] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Crear Nueva Clase
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-600 text-lg">
          Cargando clases...
        </div>
      ) : classes.length > 0 ? ( // Lógica de renderizado mejorada
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((classItem) => (
            <div
              key={classItem.id}
              className="bg-gray-200/60 backdrop-blur-sm rounded-xl p-6 shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] hover:shadow-[6px_6px_12px_#d1d9e6,-6px_-6px_12px_#ffffff] transition-all duration-200 flex flex-col justify-between"
            >
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  {classItem.name || 'Clase sin nombre'}
                </h3>
                {classItem.subject && (
                  <p className="text-gray-600 mb-1 text-sm">
                    <span className="font-medium">Materia:</span> {classItem.subject}
                  </p>
                )}
                {classItem.grade_level && (
                  <p className="text-gray-600 text-sm">
                    <span className="font-medium">Nivel:</span> {classItem.grade_level}
                  </p>
                )}
              </div>
              <Link 
                href={`/dashboard/class/${classItem.id}`}
                className="w-full bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff] hover:shadow-[3px_3px_6px_#d1d9e6,-3px_-3px_6px_#ffffff] active:shadow-inner-[2px_2px_4px_#d1d9e6,-2px_-2px_4px_#ffffff] transition-all duration-200 block text-center"
              >
                Ver Exámenes
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-600 text-lg mt-8">
          No tienes clases creadas aún. ¡Crea tu primera clase!
        </div>
      )}
      
      {isModalOpen && ( // Renderizar el modal solo si está abierto
        <CreateClassModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onClassCreated={fetchClasses} // Pasamos la función para refrescar la lista
        />
      )}
    </div>
  )
}