'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import Link from 'next/link'
import CreateClassModal from '../../components/CreateClassModal'

interface Class { id: string; name: string | null; subject: string | null; grade_level: string | null; }
interface Profile { profile_completed: boolean; }

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  // Datos
  const [classes, setClasses] = useState<Class[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Modales y Menús
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Estado para el menú desplegable (ID de la clase cuyo menú está abierto)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  // Estado para Eliminar
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [classToDelete, setClassToDelete] = useState<Class | null>(null)

  // Estado para Editar
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [classToEdit, setClassToEdit] = useState<Class | null>(null)
  const [newClassName, setNewClassName] = useState('')

  // Cargar datos
  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const profilePromise = supabase.from('profiles').select('profile_completed').eq('id', user.id).single();
    const classesPromise = supabase.from('classes').select('*').eq('user_id', user.id).order('created_at', { ascending: false });

    const [profileResult, classesResult] = await Promise.all([profilePromise, classesPromise]);

    if (profileResult.error) console.error("Error al cargar perfil:", profileResult.error);
    else setProfile(profileResult.data);

    if (classesResult.error) console.error("Error al cargar clases:", classesResult.error);
    else setClasses(classesResult.data || []);

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cerrar menú si se hace clic fuera
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    if (activeMenuId) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeMenuId]);

  const handleCreateClassClick = () => {
    if (profile?.profile_completed === false) {
      router.push('/onboarding');
    } else {
      setIsCreateModalOpen(true);
    }
  };

  // --- Lógica del Menú ---
  const toggleMenu = (e: React.MouseEvent, classId: string) => {
    e.stopPropagation(); // Evitar que el clic se propague al documento y cierre el menú inmediatamente
    e.preventDefault();
    setActiveMenuId(activeMenuId === classId ? null : classId);
  };

  // --- Lógica de Eliminar ---
  const openDeleteModal = (e: React.MouseEvent, classItem: Class) => {
    e.stopPropagation(); // Evitar navegación si el card es un link (aunque aquí el link es un botón aparte)
    setActiveMenuId(null);
    setClassToDelete(classItem);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!classToDelete) return;

    const { error } = await supabase.from('classes').delete().eq('id', classToDelete.id);

    if (error) {
      console.error('Error al eliminar:', error);
      alert('Error al eliminar la clase');
    } else {
      await fetchData(); // Refrescar lista
      setIsDeleteModalOpen(false);
      setClassToDelete(null);
    }
  };

  // --- Lógica de Editar ---
  const openEditModal = (e: React.MouseEvent, classItem: Class) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setClassToEdit(classItem);
    setNewClassName(classItem.name || '');
    setIsEditModalOpen(true);
  };

  const confirmEdit = async () => {
    if (!classToEdit) return;

    const { error } = await supabase
      .from('classes')
      .update({ name: newClassName })
      .eq('id', classToEdit.id);

    if (error) {
      console.error('Error al actualizar:', error);
      alert('Error al actualizar la clase');
    } else {
      await fetchData(); // Refrescar lista
      setIsEditModalOpen(false);
      setClassToEdit(null);
      setNewClassName('');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8 neu-container min-h-screen relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-700">Mis Clases</h1>
          <p className="text-gray-500">Gestiona tus clases y exámenes</p>
        </div>
        <button
          onClick={handleCreateClassClick}
          className="neu-button px-6 py-3 font-semibold text-gray-700"
        >
          Crear Nueva Clase
        </button>
      </div>

      {classes.length === 0 ? (
        <div className="text-center py-16 neu-card">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-semibold text-gray-700">No tienes clases creadas aún</h3>
          <p className="text-gray-600 mb-6">¡Crea tu primera clase para comenzar!</p>
          <button 
            onClick={handleCreateClassClick}
            className="neu-button px-8 py-4 font-bold text-gray-800"
          >
            Crear Primera Clase
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((classItem) => (
            <div key={classItem.id} className="neu-card p-6 flex flex-col justify-between relative">

              {/* --- Botón de Menú (Tres Puntos) --- */}
              <div className="absolute top-4 right-4">
                <button 
                  onClick={(e) => toggleMenu(e, classItem.id)}
                  className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
                >
                  {/* Icono 3 puntos vertical */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>

                {/* --- Menú Desplegable --- */}
                {activeMenuId === classItem.id && (
                  <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-100 overflow-hidden">
                    <button
                      onClick={(e) => openEditModal(e, classItem)}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Editar Nombre
                    </button>
                    <button
                      onClick={(e) => openDeleteModal(e, classItem)}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>

              <div className="pr-8"> {/* Padding right para no chocar con el menú */}
                <h3 className="text-xl font-semibold mb-2">{classItem.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{classItem.subject || 'Sin materia'}</p>
              </div>
              <Link href={`/dashboard/class/${classItem.id}`} className="neu-button text-center block py-2 mt-2">
                Ver Exámenes
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* --- Modal Crear Clase --- */}
      {isCreateModalOpen && (
        <CreateClassModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onClassCreated={fetchData} 
        />
      )}

      {/* --- Modal Editar Clase --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Editar Clase</h2>
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="w-full p-2 border rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nombre de la clase"
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={!newClassName.trim()}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Modal Eliminar Clase --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-2 text-red-600">Eliminar Clase</h2>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que quieres eliminar la clase <strong>{classToDelete?.name}</strong>? 
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}