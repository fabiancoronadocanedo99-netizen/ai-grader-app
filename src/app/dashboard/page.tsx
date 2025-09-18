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
      // Intentar primero con filtro de teacher_id
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })
      
      if (error) {
        // Si hay error de columna, usar fallback sin filtro (temporal)
        console.warn('Error con teacher_id, usando fallback:', error.message)
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('classes')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (fallbackError) {
          console.error('Error al cargar las clases:', fallbackError.message)
          alert(`Error al cargar las clases: ${fallbackError.message}`)
        } else {
          setClasses(fallbackData || [])
        }
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
        // .eq('teacher_id', user.id)  // Temporalmente comentado por cache

      if (error) {
        console.error('Error al eliminar la clase:', error.message)
        alert(`Error al eliminar la clase: ${error.message}`)
      } else {
        // Actualizar la lista de clases
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
        // .eq('teacher_id', user.id)  // Temporalmente comentado por cache

      if (error) {
        console.error('Error al editar la clase:', error.message)
        alert(`Error al editar la clase: ${error.message}`)
      } else {
        // Actualizar la lista de clases
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
      await fetchClasses()
      await fetchProfile()
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
              {/* Header con título y menú de tres puntos */}
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3 flex-1 pr-4">
                  {classItem.name || 'Clase sin nombre'}
                </h3>
                
                {/* Botón de menú tres puntos */}
                <div className="relative dropdown-container">
                  <button
                    onClick={() => setOpenDropdownId(openDropdownId === classItem.id ? null : classItem.id)}
                    className="p-2 rounded-full hover:bg-gray-200 transition-colors duration-200 text-gray-600 hover:text-gray-800"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  
                  {/* Menú desplegable */}
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
      
      {/* Modal de creación de clase */}
      {isModalOpen && (
        <CreateClassModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onClassCreated={fetchClasses}
        />
      )}

      {/* Modal de edición de nombre */}
      {showEditModal && classToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 m-4 max-w-md w-full neu-card">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Editar nombre de clase
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Ingresa el nuevo nombre para la clase
              </p>
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="w-full neu-input text-gray-700 py-3 px-4 mb-6"
                placeholder="Nombre de la clase"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleEditClassName()
                  }
                  if (e.key === 'Escape') {
                    setShowEditModal(false)
                    setClassToEdit(null)
                    setEditingName('')
                  }
                }}
              />
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setClassToEdit(null)
                    setEditingName('')
                  }}
                  className="flex-1 neu-button text-gray-700 font-medium py-3 px-4"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEditClassName}
                  disabled={!editingName.trim()}
                  className={`flex-1 font-medium py-3 px-4 rounded-xl transition-colors duration-200 ${
                    editingName.trim() 
                      ? 'neu-button text-gray-700 hover:bg-blue-50' 
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && classToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 m-4 max-w-md w-full neu-card">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L5.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Confirmar eliminación
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                ¿Estás seguro de que quieres eliminar la clase <strong>"{classToDelete.name}"</strong>? Esta acción no se puede deshacer.
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setClassToDelete(null)
                  }}
                  className="flex-1 neu-button text-gray-700 font-medium py-3 px-4"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteClass}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-4 rounded-xl transition-colors duration-200"
                >
                  Confirmar Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}