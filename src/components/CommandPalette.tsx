'use client'

import { useState, useEffect } from 'react'
import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'

interface Class {
  id: number
  name: string
  subject?: string
  grade_level?: string
}

interface Exam {
  id: number
  title: string
  class_id: number
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [classes, setClasses] = useState<Class[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Atajo de teclado Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Cargar datos cuando se abre la paleta
  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  const loadData = async () => {
    setLoading(true)
    try {
      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('Usuario no autenticado')
        return
      }

      // Cargar clases
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (classesError) {
        console.error('Error al cargar las clases:', classesError.message)
      } else {
        setClasses(classesData || [])
      }

      // Cargar exámenes
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (examsError) {
        console.error('Error al cargar los exámenes:', examsError.message)
      } else {
        setExams(examsData || [])
      }
    } catch (error) {
      console.error('Error inesperado al cargar datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectClass = (classId: number) => {
    router.push(`/dashboard/class/${classId}`)
    setOpen(false)
  }

  const handleSelectExam = (examId: number, classId: number) => {
    router.push(`/dashboard/class/${classId}/exam/${examId}`)
    setOpen(false)
  }

  return (
    <Command.Dialog 
      open={open} 
      onOpenChange={setOpen}
      label="Búsqueda Universal - Buscar clases y exámenes"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20"
    >
      {/* Overlay semitransparente */}
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
      
      {/* Modal con diseño Neumórfico */}
      <div className="relative neu-card w-full max-w-lg mx-4 overflow-hidden">
        {/* Barra de búsqueda */}
        <Command.Input
          placeholder="Buscar clases, exámenes..."
          className="neu-input w-full p-4 text-gray-700 placeholder-gray-500 border-0 bg-transparent focus:outline-none focus:ring-0"
        />
        
        {/* Lista de resultados */}
        <Command.List className="max-h-80 overflow-y-auto p-2">
          {/* Mensaje de cargando */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <span className="text-gray-500">Cargando...</span>
            </div>
          )}

          {/* Mensaje de no hay resultados */}
          <Command.Empty className="flex items-center justify-center py-8">
            <span className="text-gray-500">No se encontraron resultados</span>
          </Command.Empty>

          {/* Grupo de Clases */}
          {classes.length > 0 && (
            <Command.Group heading="Clases" className="mb-4">
              {classes.map((cls) => (
                <Command.Item
                  key={`class-${cls.id}`}
                  value={`${cls.name} ${cls.subject || ''} ${cls.grade_level || ''}`}
                  onSelect={() => handleSelectClass(cls.id)}
                  className="neu-button-flat flex items-center px-3 py-2 mb-1 cursor-pointer text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600 text-sm font-semibold">📚</span>
                    </div>
                    <div>
                      <div className="font-medium">{cls.name}</div>
                      {(cls.subject || cls.grade_level) && (
                        <div className="text-xs text-gray-500">
                          {cls.subject} {cls.grade_level && `• ${cls.grade_level}`}
                        </div>
                      )}
                    </div>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Grupo de Exámenes */}
          {exams.length > 0 && (
            <Command.Group heading="Exámenes" className="mb-4">
              {exams.map((exam) => {
                const examClass = classes.find(c => c.id === exam.class_id)
                return (
                  <Command.Item
                    key={`exam-${exam.id}`}
                    value={`${exam.title} ${examClass?.name || ''}`}
                    onSelect={() => handleSelectExam(exam.id, exam.class_id)}
                    className="neu-button-flat flex items-center px-3 py-2 mb-1 cursor-pointer text-gray-700 hover:bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <span className="text-green-600 text-sm font-semibold">📝</span>
                      </div>
                      <div>
                        <div className="font-medium">{exam.title}</div>
                        {examClass && (
                          <div className="text-xs text-gray-500">
                            en {examClass.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </Command.Item>
                )
              })}
            </Command.Group>
          )}
        </Command.List>

        {/* Indicador de atajos */}
        <div className="border-t border-gray-200 px-4 py-2 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Presiona ↵ para seleccionar</span>
            <span>Esc para cerrar</span>
          </div>
        </div>
      </div>
    </Command.Dialog>
  )
}