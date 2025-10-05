'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onClassCreated: () => void;
}

export default function CreateClassModal({ isOpen, onClose, onClassCreated }: Props) {
  const supabase = createClient();
  const supabase = createClientComponentClient(); // <-- CORRECCIÓN
  const [newClassName, setNewClassName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado.");

      const { error } = await supabase.from('classes').insert({
        name: newClassName.trim(),
        user_id: user.id
      });

      if (error) throw error;

      alert('¡Clase creada con éxito!');
      onClassCreated(); // Refresca la lista de clases en el dashboard
      onClose(); // Cierra el modal
    } catch (error) {
      alert(`Error al crear la clase: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="neu-card p-8 rounded-lg w-full max-w-md">
        <h3 className="text-xl font-bold text-center mb-6">Crear Nueva Clase</h3>
        <form onSubmit={handleCreateClass}>
          <div className="mb-4">
            <label htmlFor="className" className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de la Clase
            </label>
            <input
              id="className"
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="neu-input w-full p-3"
              placeholder="Ej: Salón 101"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-4 mt-6">
            <button type="button" onClick={onClose} className="neu-button px-4 py-2">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="neu-button px-4 py-2 disabled:opacity-50">
              {loading ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}