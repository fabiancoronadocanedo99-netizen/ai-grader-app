'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

interface CreateClassModalProps {
  isOpen: boolean
  onClose: () => void
  onClassCreated: () => void
}

export default function CreateClassModal({ isOpen, onClose, onClassCreated }: CreateClassModalProps) {
  const [newClassName, setNewClassName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newClassName.trim()) {
      alert('Por favor ingresa un nombre para la clase')
      return
    }

    setIsSubmitting(true)
    
    try {
      // Obtener el usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Usuario no autenticado')
        return
      }

      // Asegurar que existe el perfil del usuario (crear si no existe)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id,
          full_name: user.email || 'Usuario',
          profile_completed: false
        }, { 
          onConflict: 'id',
          ignoreDuplicates: true 
        })
      
      if (profileError) {
        alert(`Error al crear el perfil: ${profileError.message}`)
        return
      }

      // Crear la clase directamente en Supabase
      const { error } = await supabase
        .from('classes')
        .insert([{ 
          name: newClassName.trim(),
          user_id: user.id
        }])
      
      if (error) {
        alert(`Error al crear la clase: ${error.message}`)
      } else {
        // Limpiar el formulario y cerrar el modal
        setNewClassName('')
        onClose()
        // Llamar a la función para actualizar la lista de clases
        onClassCreated()
      }
    } catch (error) {
      alert(`Error inesperado: ${error}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setNewClassName('')
    onClose()
  }

  // Si el modal no está abierto, no renderizar nada
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay semitransparente */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={handleCancel}
      />
      
      {/* Modal con diseño Glassmórfico */}
      <div className="relative neu-card p-8 max-w-md w-full mx-4">
        {/* Título del modal */}
        <h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">
          Crear Nueva Clase
        </h2>
        
        {/* Formulario */}
        <form onSubmit={handleCreateClass} className="space-y-6">
          {/* Campo de nombre de la clase */}
          <div>
            <label htmlFor="className" className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de la Clase
            </label>
            <input
              type="text"
              id="className"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              required
              className="neu-input w-full p-4 text-gray-700 placeholder-gray-500"
              placeholder="Ej: Matemáticas 101"
              disabled={isSubmitting}
            />
          </div>
          
          {/* Botones de acción */}
          <div className="flex space-x-4">
            {/* Botón Cancelar */}
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="flex-1 neu-button text-gray-700 font-semibold py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            
            {/* Botón Crear */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 neu-button text-gray-700 font-semibold py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
