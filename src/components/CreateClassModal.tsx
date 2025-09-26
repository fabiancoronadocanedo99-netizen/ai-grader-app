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
      // Obtener el token de acceso del usuario actual
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        alert('No se pudo obtener el token de autenticación');
        return;
      }

      // Usar la API Route para crear la clase (evita problemas de cache del esquema)
      const response = await fetch('/api/create-class', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ className: newClassName.trim() })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        // Limpiar el formulario y cerrar el modal
        setNewClassName('')
        onClose()
        // Llamar a la función para actualizar la lista de clases
        onClassCreated()
        alert('¡Clase creada exitosamente!')
      } else {
        throw new Error(data.error || 'Error desconocido al crear la clase');
      }
    } catch (error) {
      alert(`Error al crear la clase: ${(error as Error).message}`)
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
