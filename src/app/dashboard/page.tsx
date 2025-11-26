'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabaseClient'

interface CreateClassModalProps {
  isOpen: boolean
  onClose: () => void
  onClassCreated: () => void
}

export default function CreateClassModal({ isOpen, onClose, onClassCreated }: CreateClassModalProps) {
  const supabase = createClient()
  const [className, setClassName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!className.trim()) {
      alert("Por favor, introduce un nombre para la clase.")
      return
    }

    setIsCreating(true)

    try {
      // 1. Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Usuario no encontrado")

      // 2. --- PASO CLAVE: OBTENER EL PERFIL Y SU ORGANIZACIÓN ---
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (profileError || !profile?.organization_id) {
        throw new Error("No se pudo encontrar la organización asociada a tu usuario. Contacta al administrador.")
      }

      // 3. --- INSERTAR LA CLASE CON LA ORGANIZACIÓN ---
      const { error } = await supabase.from('classes').insert({
        name: className,
        user_id: user.id,
        organization_id: profile.organization_id, // <-- ¡CAMPO CRÍTICO!
      })

      if (error) throw error

      // 4. Finalizar
      alert("¡Clase creada con éxito!")
      setClassName("")
      onClassCreated() // Recargar la lista en el Dashboard
      onClose() // Cerrar el modal

    } catch (error) {
      console.error(error)
      alert(`Error al crear la clase: ${(error as Error).message}`)
    } finally {
      setIsCreating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md mx-4">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Crear Nueva Clase</h2>

        <form onSubmit={handleCreateClass}>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Nombre de la Clase
            </label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="shadow appearance-none border rounded w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-500"
              placeholder="Ej. Matemáticas 101"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-medium transition-colors"
              disabled={isCreating}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creando...
                </>
              ) : (
                'Crear Clase'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}