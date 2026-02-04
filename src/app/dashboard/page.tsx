'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabaseClient'
import CreateClassModal from '../../components/CreateClassModal'
import { BookOpen, X, Save, AlertCircle } from 'lucide-react'

// IMPORTACIÓN DE LAS SERVER ACTIONS
import { updateUserSubjects } from '@/actions/user-actions'

interface Class { 
  id: string; 
  name: string | null; 
  subject: string | null; 
  grade_level: string | null; 
}

interface Profile { 
  onboarding_completed: boolean; // Actualizado de profile_completed
  subjects_taught: string | null; 
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  // --- Estados de Datos ---
  const [classes, setClasses] = useState<Class[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // --- Estados de UI ---
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [classToDelete, setClassToDelete] = useState<Class | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [classToEdit, setClassToEdit] = useState<Class | null>(null)
  const [newClassName, setNewClassName] = useState('')

  // Estados para materias
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false)
  const [subjectsInput, setSubjectsInput] = useState('')
  const [isSavingSubjects, setIsSavingSubjects] = useState(false)

  // --- Lógica de Datos ---
  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const profilePromise = supabase
      .from('profiles')
      .select('onboarding_completed, subjects_taught')
      .eq('id', user.id)
      .single();

    const classesPromise = supabase
      .from('classes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const [profileResult, classesResult] = await Promise.all([profilePromise, classesPromise]);

    if (profileResult.error) {
      console.error("Error al cargar perfil:", profileResult.error);
    } else {
      setProfile(profileResult.data as Profile);
      // Si subjects_taught es un array en la DB, lo unimos con comas para el textarea
      const subjects = profileResult.data.subjects_taught;
      setSubjectsInput(Array.isArray(subjects) ? subjects.join(', ') : (subjects || ''));
    }

    if (profileResult.data && profileResult.data.onboarding_completed === false) {
      router.push('/onboarding');
      return;
    }

    if (classesResult.error) {
      console.error("Error al cargar clases:", classesResult.error);
    } else {
      setClasses(classesResult.data || []);
    }

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Lógica de Materias (CORREGIDA CON SERVER ACTION) ---
  const handleUpdateSubjects = async () => {
    if (!subjectsInput.trim()) {
      alert("Por favor, escribe al menos una materia.");
      return;
    }

    setIsSavingSubjects(true);
    try {
      // LLAMADA A LA SERVER ACTION
      const result = await updateUserSubjects(subjectsInput);

      if (result.success) {
        alert("¡Materias configuradas con éxito!");
        setIsSubjectModalOpen(false);
        // Refrescamos los datos locales
        await fetchData();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert("Error de comunicación con el servidor.");
    } finally {
      setIsSavingSubjects(false);
    }
  };

  // --- Lógica de UI y CRUD ---
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    if (activeMenuId) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeMenuId]);

  const handleCreateClassClick = () => {
    if (profile?.onboarding_completed === false) {
      router.push('/onboarding');
    } else {
      setIsCreateModalOpen(true);
    }
  };

  const toggleMenu = (e: React.MouseEvent, classId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveMenuId(activeMenuId === classId ? null : classId);
  };

  const openEditModal = (e: React.MouseEvent, classItem: Class) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setClassToEdit(classItem);
    setNewClassName(classItem.name || '');
    setIsEditModalOpen(true);
  };

  const confirmEdit = async () => {
    if (!classToEdit || !newClassName.trim()) return;
    const { error } = await supabase.from('classes').update({ name: newClassName }).eq('id', classToEdit.id);
    if (error) alert('Error al actualizar la clase.');
    else { await fetchData(); setIsEditModalOpen(false); setClassToEdit(null); }
  };

  const openDeleteModal = (e: React.MouseEvent, classItem: Class) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setClassToDelete(classItem);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!classToDelete) return;
    const { error } = await supabase.from('classes').delete().eq('id', classToDelete.id);
    if (error) alert('Error al eliminar la clase.');
    else { await fetchData(); setIsDeleteModalOpen(false); setClassToDelete(null); }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center neu-container">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8 neu-container min-h-screen relative">

      {/* --- Encabezado --- */}
      <div className="flex justify-between items-center mb-6">
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

      {/* --- Banner de Materias (Solo si no hay materias configuradas) --- */}
      {profile && (!profile.subjects_taught || profile.subjects_taught.length === 0) && (
        <div 
          onClick={() => setIsSubjectModalOpen(true)}
          className="mb-8 p-4 rounded-2xl bg-[#e0e5ec] shadow-[9px_9px_16px_#b8c1ce,-9px_-9px_16px_#ffffff] cursor-pointer flex items-center justify-between group hover:scale-[1.01] transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full shadow-[inset_2px_2px_5px_#b8c1ce,inset_-2px_-2px_5px_#ffffff]">
              <AlertCircle className="text-blue-500 w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-gray-700">Configura las materias que impartes</p>
              <p className="text-xs text-gray-500">Esto nos ayuda a generar analíticas más precisas para ti.</p>
            </div>
          </div>
          <button className="neu-button-white !py-2 !px-4 text-xs font-bold text-blue-600">
            Configurar
          </button>
        </div>
      )}

      {/* --- Listado de Clases --- */}
      {classes.length === 0 ? (
        <div className="text-center py-16 neu-card">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-semibold text-gray-700">No tienes clases creadas aún</h3>
          <p className="text-gray-600 mb-6">¡Crea tu primera clase para comenzar!</p>
          <button onClick={handleCreateClassClick} className="neu-button px-8 py-4 font-bold text-gray-800">
            Crear Primera Clase
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((classItem) => (
            <div key={classItem.id} className="neu-card p-6 flex flex-col justify-between relative group">
              <div className="absolute top-4 right-4">
                <button onClick={(e) => toggleMenu(e, classItem.id)} className="p-1 rounded-full text-gray-500 hover:bg-gray-100 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
                {activeMenuId === classItem.id && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-100 overflow-hidden">
                    <button onClick={(e) => openEditModal(e, classItem)} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Editar Nombre</button>
                    <button onClick={(e) => openDeleteModal(e, classItem)} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Eliminar Clase</button>
                  </div>
                )}
              </div>
              <div className="pr-8">
                <h3 className="text-xl font-semibold mb-2 text-gray-800">{classItem.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{classItem.subject || 'Sin materia'}</p>
              </div>
              <Link href={`/dashboard/class/${classItem.id}`} className="neu-button-white text-center block py-2 mt-4 no-underline font-bold text-blue-600">
                Ver Exámenes
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* --- Modal Materias --- */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#e0e5ec] p-8 rounded-[30px] shadow-[20px_20px_60px_#a3b1c6,-20px_-20px_60px_#ffffff] w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-700">Mis Materias</h2>
              <button onClick={() => setIsSubjectModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X /></button>
            </div>

            <p className="text-sm text-gray-500 mb-4">Escribe las materias que impartes separadas por comas.</p>

            <div className="shadow-[inset_6px_6px_10px_#b8c1ce,inset_-6px_-6px_10px_#ffffff] rounded-xl overflow-hidden mb-8">
                <textarea
                  value={subjectsInput}
                  onChange={(e) => setSubjectsInput(e.target.value)}
                  className="w-full p-4 bg-transparent outline-none text-gray-700 min-h-[120px]"
                  placeholder="Ej: Matemáticas, Física, Álgebra..."
                />
            </div>

            <button 
              onClick={handleUpdateSubjects}
              disabled={isSavingSubjects}
              className="neu-button w-full py-4 font-bold text-blue-600 flex items-center justify-center gap-2"
            >
              {isSavingSubjects ? 'Guardando...' : <><Save size={18}/> Guardar Configuración</>}
            </button>
          </div>
        </div>
      )}

      {/* --- Otros Modales --- */}
      {isCreateModalOpen && (
        <CreateClassModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onClassCreated={fetchData} />
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Editar Nombre</h2>
            <input type="text" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} className="w-full p-2 border rounded mb-6 outline-none" placeholder="Nuevo nombre"/>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
              <button onClick={confirmEdit} className="px-4 py-2 bg-blue-600 text-white rounded">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-2 text-red-600">Eliminar Clase</h2>
            <p className="text-gray-600 mb-6">¿Estás seguro de que quieres eliminar la clase <strong>"{classToDelete?.name}"</strong>?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}