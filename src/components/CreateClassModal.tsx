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
      const { error } = await supabase
        .from('classes')
        .insert([{ name: newClassName.trim() }])
      
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
      <div className="relative bg-gray-200/60 backdrop-blur-md rounded-xl p-8 shadow-lg max-w-md w-full mx-4">
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
              className="w-full bg-gray-200 border border-gray-300/50 rounded-lg p-4 shadow-inner-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff] text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-300/50"
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
              className="flex-1 bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff] hover:shadow-[3px_3px_6px_#d1d9e6,-3px_-3px_6px_#ffffff] active:shadow-inner-[2px_2px_4px_#d1d9e6,-2px_-2px_4px_#ffffff] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            
            {/* Botón Crear */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff] hover:shadow-[3px_3px_6px_#d1d9e6,-3px_-3px_6px_#ffffff] active:shadow-inner-[2px_2px_4px_#d1d9e6,-2px_-2px_4px_#ffffff] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
