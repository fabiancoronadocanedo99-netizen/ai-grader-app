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

  // Estados para edición de nombre
  const [showEditModal, setShowEditModal] = useState(false)
  const [classToEdit, setClassToEdit] = useState<Class | null>(null)
  const [editingName, setEditingName] = useState('')

  const fetchClasses = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('Usuario no autenticado')
      return
    }

    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('user_id', user.id) // <--- CORRECCIÓN #1
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error al cargar las clases:', error.message)
        alert(`Error al cargar las clases: ${error.message}`)
      } else {
        setClasses(data || [])
      }
    } catch (error) {
      console.error('Error inesperado al cargar las clases:', error)
      alert('Error inesperado al cargar las clases')
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

  // Función para eliminar clase
  const handleDeleteClass = async () => {
    if (!classToDelete) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Usuario no autenticado')
        return
      }

      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classToDelete.id)
        .eq('user_id', user.id) // <--- CORRECCIÓN #2

      if (error) {
        console.error('Error al eliminar la clase:', error.message)
        alert(`Error al eliminar la clase: ${error.message}`)
      } else {
        await fetchClasses()
        setShowDeleteModal(false)
        setClassToDelete(null)
      }
    } catch (error) {
      console.error('Error al eliminar la clase:', error)
      alert('Error inesperado al eliminar la clase')
    }
  }

  // Función para editar nombre de clase
  const handleEditClassName = async () => {
    if (!classToEdit || !editingName.trim()) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Usuario no autenticado')
        return
      }

      const { error } = await supabase
        .from('classes')
        .update({ name: editingName.trim() })
        .eq('id', classToEdit.id)
        .eq('user_id', user.id) // <--- CORRECCIÓN #3

      if (error) {
        console.error('Error al editar la clase:', error.message)
        alert(`Error al editar la clase: ${error.message}`)
      } else {
        await fetchClasses()
        setShowEditModal(false)
        setClassToEdit(null)
        setEditingName('')
      }
    } catch (error) {
      console.error('Error al editar la clase:', error)
      alert('Error inesperado al editar la clase')
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchClasses(), fetchProfile()])
      setLoading(false)
    }
    loadData()
  }, [fetchClasses, fetchProfile])

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdownId && !(event.target as Element).closest('.dropdown-container')) {
        setOpenDropdownId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openDropdownId])

  // El return JSX se mantiene igual, con los estilos Neumórficos
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
              className="neu-card p-6 transition-all duration-300 hover:transform hover:scale-105 flex flex-col justify-between relative"
            >
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3 flex-1 pr-4">
                  {classItem.name || 'Clase sin nombre'}
                </h3>
                <div className="relative dropdown-container">
                  <button
                    onClick={() => setOpenDropdownId(openDropdownId === classItem.id ? null : classItem.id)}
                    className="p-2 rounded-full hover:bg-gray-200 transition-colors duration-200 text-gray-600 hover:text-gray-800"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  {openDropdownId === classItem.id && (
                    <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-10 min-w-[140px]">
                      <button
                        onClick={() => {
                          setClassToEdit(classItem)
                          setEditingName(classItem.name || '')
                          setShowEditModal(true)
                          setOpenDropdownId(null)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                      >
                        Editar Nombre
                      </button>
                      <button
                        onClick={() => {
                          setClassToDelete(classItem)
                          setShowDeleteModal(true)
                          setOpenDropdownId(null)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="mb-6">
                  <p className="text-gray-600 text-sm">
                    <span className="font-medium">Materia:</span> {classItem.subject || 'NULL'}
                  </p>
                  <p className="text-gray-600 text-sm">
                    <span className="font-medium">Nivel:</span> {classItem.grade_level || 'NULL'}
                  </p>
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

      {showEditModal && classToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 m-4 max-w-md w-full neu-card">
            <div className="text-center">
              {/* Contenido del modal de edición */}
              <h3 className="text-lg font-bold">Editar Nombre de Clase</h3>
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="w-full neu-input my-4"
                placeholder="Nuevo nombre de la clase"
              />
              <div className="flex justify-end gap-4">
                <button onClick={() => setShowEditModal(false)} className="neu-button">Cancelar</button>
                <button onClick={handleEditClassName} className="neu-button">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && classToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 m-4 max-w-md w-full neu-card">
            <div className="text-center">
              {/* Contenido del modal de eliminación */}
              <h3 className="text-lg font-bold">Confirmar Eliminación</h3>
              <p className="my-4">¿Estás seguro de que quieres eliminar la clase <strong>"{classToDelete.name}"</strong>?</p>
              <div className="flex justify-end gap-4">
                <button onClick={() => setShowDeleteModal(false)} className="neu-button">Cancelar</button>
                <button onClick={handleDeleteClass} className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}