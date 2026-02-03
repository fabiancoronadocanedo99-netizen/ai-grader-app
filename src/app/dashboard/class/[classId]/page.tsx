'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useDropzone, FileWithPath } from 'react-dropzone'
import { createClient } from '@/lib/supabaseClient'

// --- INTERFACES ---
interface ClassDetails { id: string; name: string; subject?: string; grade_level?: string; }
interface Evaluation { id: string; name: string; class_id: string; created_at?: string; type: 'exam' | 'assignment'; subject?: string; } 
interface Student { id: string; full_name: string; student_email: string; tutor_email?: string; class_id: string; created_at?: string; }
interface Profile { subjects_taught: string | null; }

export default function ClassDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const classId = params.classId as string

  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null)
  const [allEvaluations, setAllEvaluations] = useState<Evaluation[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Tabs
  const [activeTab, setActiveTab] = useState<'evaluations' | 'students'>('evaluations')

  // Modal Crear
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newEvaluationName, setNewEvaluationName] = useState('')
  const [newEvaluationType, setNewEvaluationType] = useState<'exam' | 'assignment'>('exam')
  const [selectedSubject, setSelectedSubject] = useState('')

  // CSV
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false)
  const [csvFile, setCSVFile] = useState<File | null>(null)
  const [isProcessingCSV, setIsProcessingCSV] = useState(false)

  // --- ESTADOS PARA EDITAR/ELIMINAR ---
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  // Eliminar
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [evalToDelete, setEvalToDelete] = useState<Evaluation | null>(null)

  // Editar
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [evalToEdit, setEvalToEdit] = useState<Evaluation | null>(null)
  const [editName, setEditName] = useState('')

  const exams = useMemo(() => allEvaluations.filter(e => e.type === 'exam'), [allEvaluations])
  const assignments = useMemo(() => allEvaluations.filter(e => e.type === 'assignment'), [allEvaluations])

  // --- Lógica de materias procesadas (NUEVO) ---
  const subjectsList = useMemo(() => {
    if (!profile?.subjects_taught) return []
    return profile.subjects_taught.split(',').map(s => s.trim()).filter(Boolean)
  }, [profile])

  // Efecto para asignar materia automática si solo hay una
  useEffect(() => {
    if (subjectsList.length === 1) {
      setSelectedSubject(subjectsList[0])
    }
  }, [subjectsList])

  const fetchClassDetails = useCallback(async () => {
    if (!classId) return
    const { data, error } = await supabase.from('classes').select('*').eq('id', classId).single()
    if (error) { console.error("Error al cargar detalles de la clase:", error) } 
    else { setClassDetails(data) }
  }, [classId, supabase])

  const fetchStudents = useCallback(async () => {
    if (!classId) return
    const { data, error } = await supabase.from('students').select('*').eq('class_id', classId).order('created_at', { ascending: false })
    if (error) { console.error("Error al cargar estudiantes:", error) } 
    else { setStudents(data || []) }
  }, [classId, supabase])

  const fetchEvaluations = useCallback(async () => {
    if (!classId) return
    const { data, error } = await supabase.from('exams').select('*').eq('class_id', classId).order('created_at', { ascending: false })
    if (error) { console.error("Error al cargar evaluaciones:", error) } 
    else { setAllEvaluations(data as Evaluation[] || []) }
  }, [classId, supabase])

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('subjects_taught').eq('id', user.id).single()
    setProfile(data)
  }, [supabase])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchClassDetails(), fetchEvaluations(), fetchStudents(), fetchProfile()])
      setLoading(false)
    }
    if (classId) loadData()
  }, [classId, fetchClassDetails, fetchEvaluations, fetchStudents, fetchProfile])

  // Cerrar menú si se hace clic fuera
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    if (activeMenuId) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeMenuId]);

  // --- FUNCIONES DE MENÚ Y CRUD ---

  const toggleMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  const handleDeleteClick = (e: React.MouseEvent, evaluation: Evaluation) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMenuId(null);
    setEvalToDelete(evaluation);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!evalToDelete) return;
    const { error } = await supabase.from('exams').delete().eq('id', evalToDelete.id);
    if (error) {
      console.error('Error al eliminar:', error);
      alert('No se pudo eliminar la evaluación.');
    } else {
      await fetchEvaluations();
      setIsDeleteModalOpen(false);
      setEvalToDelete(null);
    }
  };

  const handleEditClick = (e: React.MouseEvent, evaluation: Evaluation) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMenuId(null);
    setEvalToEdit(evaluation);
    setEditName(evaluation.name);
    setIsEditModalOpen(true);
  };

  const confirmEdit = async () => {
    if (!evalToEdit) return;
    if (!editName.trim()) {
      alert('El nombre no puede estar vacío');
      return;
    }
    const { error } = await supabase
      .from('exams')
      .update({ name: editName })
      .eq('id', evalToEdit.id);
    if (error) {
      console.error('Error al editar:', error);
      alert('No se pudo actualizar la evaluación.');
    } else {
      await fetchEvaluations();
      setIsEditModalOpen(false);
      setEvalToEdit(null);
      setEditName('');
    }
  };

  const handleCreateEvaluation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEvaluationName.trim() || !classId) return

    // Validar materia si hay varias
    if (subjectsList.length > 1 && !selectedSubject) {
        alert("Por favor selecciona una materia");
        return;
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error("Usuario no autenticado")
      }
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('organization_id')
        .eq('id', classId)
        .single()
      if (classError || !classData) {
        throw new Error("No se pudo encontrar la clase para obtener la organización.")
      }
      const { error } = await supabase.from('exams').insert([{ 
        name: newEvaluationName, 
        class_id: classId, 
        type: newEvaluationType,
        subject: selectedSubject, // Guardamos la materia seleccionada
        user_id: user.id,
        organization_id: classData.organization_id
      }])
      if (error) throw error
      setNewEvaluationName('')
      setNewEvaluationType('exam')
      setIsCreateModalOpen(false)
      await fetchEvaluations()
    } catch (error) {
      alert(`Error al crear evaluación: ${(error as Error).message}`)
    }
  }

  const generateCSVTemplate = () => {
    const csvContent = 'full_name,student_email,tutor_email\n'
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'plantilla_alumnos.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const processCSVFile = async (file: File) => {
    setIsProcessingCSV(true);
    try {
      const text = await file.text();
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !data.session || !data.session.access_token) {
        throw new Error('Por favor, cierra sesión y vuelve a iniciar sesión');
      }
      const session = data.session;
      const response = await fetch('/api/process-csv', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          csvData: text,
          classId: classId 
        })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error al procesar CSV');
      }
      alert(`✅ CSV procesado: ${result.studentsAdded} alumnos añadidos.`);
      await fetchStudents();
      setIsCSVModalOpen(false);
      setCSVFile(null);
    } catch (error) {
      console.error('Error al procesar CSV:', error)
      alert(`❌ Error al procesar CSV: ${(error as Error).message}`)
    } finally {
      setIsProcessingCSV(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles: FileWithPath[]) => {
      if (acceptedFiles.length > 0) {
        setCSVFile(acceptedFiles[0])
      }
    },
    accept: { 'text/csv': ['.csv'] },
    multiple: false
  })

  const handleCSVUpload = () => {
    if (csvFile) processCSVFile(csvFile)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center neu-container">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!classDetails) {
    return (
      <div className="p-8 text-center text-lg text-red-600 neu-container">
        Error: Clase no encontrada o no tienes permiso para verla.
      </div>
    )
  }

  const EvaluationCardMenu = ({ item }: { item: Evaluation }) => (
    <>
      <div className="absolute top-4 right-4 z-10">
        <button 
          onClick={(e) => toggleMenu(e, item.id)}
          className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
        {activeMenuId === item.id && (
          <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-20 border border-gray-100 overflow-hidden">
            <button
              onClick={(e) => handleEditClick(e, item)}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Editar Nombre
            </button>
            <button
              onClick={(e) => handleDeleteClick(e, item)}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Eliminar
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="neu-container min-h-screen p-4 sm:p-8">
      <div className="mb-4 sm:mb-6">
        <Link 
          href="/dashboard"
          className="neu-button inline-flex items-center text-gray-700 font-medium py-2 px-3 sm:px-4 text-sm"
        >
          ← Volver al Dashboard
        </Link>
      </div>

      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-700 mb-2 break-words">
          {classDetails.name}
        </h1>
        {classDetails.subject && (
          <p className="text-base sm:text-lg text-gray-600">{classDetails.subject}</p>
        )}
      </div>

      <div className="neu-card p-4 sm:p-6">
        {/* PESTAÑAS RESPONSIVE CON SCROLL HORIZONTAL */}
        <div className="w-full overflow-x-auto border-b border-gray-200 mb-6">
          <div className="flex -mb-px whitespace-nowrap min-w-max">
            <button 
              onClick={() => setActiveTab('evaluations')} 
              className={`px-4 sm:px-6 py-3 font-semibold text-sm sm:text-base ${
                activeTab === 'evaluations' 
                  ? 'border-b-2 border-blue-500 text-blue-600' 
                  : 'text-gray-500'
              }`}
            >
              Evaluaciones
            </button>
            <button 
              onClick={() => setActiveTab('students')} 
              className={`px-4 sm:px-6 py-3 font-semibold text-sm sm:text-base ${
                activeTab === 'students' 
                  ? 'border-b-2 border-blue-500 text-blue-600' 
                  : 'text-gray-500'
              }`}
            >
              Alumnos
            </button>
            <Link 
              href={`/dashboard/class/${classId}/analytics`} 
              className="px-4 sm:px-6 py-3 font-semibold text-sm sm:text-base text-gray-500 hover:text-blue-600"
            >
              📊 Analíticas
            </Link>
          </div>
        </div>

        {activeTab === 'evaluations' && (
          <>
            {/* ENCABEZADO RESPONSIVE - flex-col en móvil, flex-row en desktop */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-700">
                Gestión de Evaluaciones
              </h2>
              <button 
                onClick={() => setIsCreateModalOpen(true)} 
                className="neu-button text-gray-700 font-semibold py-3 px-4 sm:px-6 text-sm sm:text-base w-full sm:w-auto"
              >
                Crear Nueva Evaluación
              </button>
            </div>

            <section className="mb-10">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-4">📝 Exámenes</h3>
              {exams.length === 0 ? (
                <p className="text-center text-gray-500 py-4 text-sm sm:text-base">
                  No hay exámenes para esta clase.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {exams.map(exam => (
                    <div key={exam.id} className="neu-card p-4 relative">
                      <EvaluationCardMenu item={exam} />
                      <div className="pr-8">
                         <h4 className="font-semibold text-gray-800 text-base sm:text-lg mb-1 break-words">
                           {exam.name}
                         </h4>
                         {exam.subject && (
                             <p className="text-xs text-blue-500 font-bold mb-3 uppercase tracking-wider">{exam.subject}</p>
                         )}
                      </div>
                      <Link 
                        href={`/dashboard/class/${classId}/exam/${exam.id}`} 
                        className="neu-button mt-2 text-center block text-sm sm:text-base"
                      >
                        Gestionar
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-4">📚 Tareas</h3>
              {assignments.length === 0 ? (
                <p className="text-center text-gray-500 py-4 text-sm sm:text-base">
                  No hay tareas para esta clase.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {assignments.map(task => (
                    <div key={task.id} className="neu-card p-4 relative">
                       <EvaluationCardMenu item={task} />
                      <div className="pr-8">
                        <h4 className="font-semibold text-gray-800 text-base sm:text-lg mb-1 break-words">
                          {task.name}
                        </h4>
                        {task.subject && (
                             <p className="text-xs text-blue-500 font-bold mb-3 uppercase tracking-wider">{task.subject}</p>
                         )}
                      </div>
                      <Link 
                        href={`/dashboard/class/${classId}/exam/${task.id}`} 
                        className="neu-button mt-2 text-center block text-sm sm:text-base"
                      >
                        Gestionar
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'students' && (
          <>
            {/* ENCABEZADO RESPONSIVE - flex-col en móvil, flex-row en desktop */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-700">
                Gestión de Alumnos
              </h2>
              <button 
                onClick={() => setIsCSVModalOpen(true)} 
                className="neu-button text-gray-700 font-semibold py-3 px-4 sm:px-6 text-sm sm:text-base w-full sm:w-auto"
              >
                📤 Importar CSV
              </button>
            </div>

            <div className="neu-card p-2 sm:p-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 sm:py-4 px-2 sm:px-4 font-semibold text-gray-700 text-sm sm:text-base">
                        Nombre Completo
                      </th>
                      <th className="text-left py-3 sm:py-4 px-2 sm:px-4 font-semibold text-gray-700 text-sm sm:text-base">
                        Email Alumno
                      </th>
                      <th className="text-left py-3 sm:py-4 px-2 sm:px-4 font-semibold text-gray-700 text-sm sm:text-base">
                        Email Tutor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center py-8 sm:py-12 text-gray-600 text-sm sm:text-base px-4">
                          Aún no hay alumnos en esta clase. ¡Impórtalos desde un CSV!
                        </td>
                      </tr>
                    ) : (
                      students.map((student) => (
                        <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                          <td className="py-3 sm:py-4 px-2 sm:px-4 text-gray-700 font-medium text-sm sm:text-base">
                            <Link 
                              href={`/dashboard/student/${student.id}`} 
                              className="hover:underline text-blue-600 break-words"
                            >
                              {student.full_name}
                            </Link>
                          </td>
                          <td className="py-3 sm:py-4 px-2 sm:px-4 text-gray-600 text-sm sm:text-base break-all">
                            {student.student_email}
                          </td>
                          <td className="py-3 sm:py-4 px-2 sm:px-4 text-gray-600 text-sm sm:text-base break-all">
                            {student.tutor_email || 'No especificado'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODAL CREAR EVALUACIÓN (ACTUALIZADO CON MATERIA) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setIsCreateModalOpen(false)} 
          />
          <div className="relative bg-[#e0e5ec] p-8 rounded-[30px] shadow-[20px_20px_60px_#a3b1c6,-20px_-20px_60px_#ffffff] w-full max-w-lg z-50 animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-700">
              Nueva Evaluación
            </h2>
            <form onSubmit={handleCreateEvaluation}>

              {/* Selector de Tipo (Neumórfico) */}
              <div className="mb-6">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Tipo de Evaluación</label>
                <div className="flex gap-2 p-2 shadow-[inset_4px_4px_8px_#b8c1ce,inset_-4px_-4px_8px_#ffffff] rounded-2xl">
                  <button 
                    type="button" 
                    onClick={() => setNewEvaluationType('exam')} 
                    className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                      newEvaluationType === 'exam' 
                        ? 'bg-[#e0e5ec] shadow-[4px_4px_8px_#b8c1ce,-4px_-4px_8px_#ffffff] text-blue-600' 
                        : 'text-gray-400'
                    }`}
                  >
                    📝 Examen
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setNewEvaluationType('assignment')} 
                    className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                      newEvaluationType === 'assignment' 
                        ? 'bg-[#e0e5ec] shadow-[4px_4px_8px_#b8c1ce,-4px_-4px_8px_#ffffff] text-blue-600' 
                        : 'text-gray-400'
                    }`}
                  >
                    📚 Tarea
                  </button>
                </div>
              </div>

              {/* Selector de Materia (Inteligente - Solo aparece si hay 2 o más) */}
              {subjectsList.length > 1 && (
                <div className="mb-6">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Materia</label>
                  <div className="relative">
                    <select 
                      value={selectedSubject} 
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="w-full p-4 rounded-xl bg-[#e0e5ec] shadow-[inset_6px_6px_10px_#b8c1ce,inset_-6px_-6px_10px_#ffffff] outline-none text-gray-700 appearance-none cursor-pointer"
                      required
                    >
                      <option value="">Seleccionar Materia...</option>
                      {subjectsList.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        ▼
                    </div>
                  </div>
                </div>
              )}

              {/* Nombre de la Evaluación */}
              <div className="mb-8">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Nombre de la Evaluación
                </label>
                <input 
                  type="text" 
                  value={newEvaluationName} 
                  onChange={(e) => setNewEvaluationName(e.target.value)} 
                  className="w-full p-4 rounded-xl bg-[#e0e5ec] shadow-[inset_6px_6px_10px_#b8c1ce,inset_-6px_-6px_10px_#ffffff] outline-none text-gray-700"
                  placeholder={newEvaluationType === 'exam' ? "Ej: Parcial de Álgebra" : "Ej: Guía Capítulo 5"} 
                  required 
                />
              </div>

              <div className="flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setIsCreateModalOpen(false)} 
                  className="flex-1 py-4 rounded-2xl font-bold text-gray-500 shadow-[6px_6px_12px_#b8c1ce,-6px_-6px_12px_#ffffff] active:shadow-[inset_4px_4px_8px_#b8c1ce,inset_-4px_-4px_8px_#ffffff] transition-all"
                >
                  Cancelar
                </button>
                <button 
                    type="submit" 
                    className="flex-1 py-4 rounded-2xl font-bold text-blue-600 shadow-[6px_6px_12px_#b8c1ce,-6px_-6px_12px_#ffffff] active:shadow-[inset_4px_4px_8px_#b8c1ce,inset_-4px_-4px_8px_#ffffff] transition-all"
                >
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/50" onClick={() => setIsEditModalOpen(false)} />
           <div className="relative neu-card p-6 w-full max-w-md bg-white z-50">
             <h2 className="text-lg sm:text-xl font-bold mb-4">Editar Nombre</h2>
             <input
               type="text"
               value={editName}
               onChange={(e) => setEditName(e.target.value)}
               className="neu-input w-full p-3 mb-6 text-sm sm:text-base"
               placeholder="Nuevo nombre..."
               autoFocus
             />
             <div className="flex flex-col sm:flex-row justify-end gap-3">
               <button 
                 onClick={() => setIsEditModalOpen(false)}
                 className="neu-button px-4 py-2 text-gray-600 text-sm sm:text-base"
               >
                 Cancelar
               </button>
               <button 
                 onClick={confirmEdit}
                 className="neu-button px-4 py-2 text-blue-600 font-bold text-sm sm:text-base"
               >
                 Guardar
               </button>
             </div>
           </div>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/50" onClick={() => setIsDeleteModalOpen(false)} />
           <div className="relative neu-card p-6 w-full max-w-md bg-white z-50">
             <h2 className="text-lg sm:text-xl font-bold mb-2 text-red-600">
               Eliminar Evaluación
             </h2>
             <p className="text-gray-600 mb-6 text-sm sm:text-base">
               ¿Estás seguro de que quieres eliminar <strong>{evalToDelete?.name}</strong>? 
               <br/>Se perderán todos los datos asociados.
             </p>
             <div className="flex flex-col sm:flex-row justify-end gap-3">
               <button 
                 onClick={() => setIsDeleteModalOpen(false)}
                 className="neu-button px-4 py-2 text-gray-600 text-sm sm:text-base"
               >
                 Cancelar
               </button>
               <button 
                 onClick={confirmDelete}
                 className="neu-button px-4 py-2 text-red-600 font-bold text-sm sm:text-base"
               >
                 Eliminar
               </button>
             </div>
           </div>
        </div>
      )}

      {/* MODAL CSV */}
      {isCSVModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setIsCSVModalOpen(false)} 
          />
          <div className="relative neu-card p-6 sm:p-8 max-w-2xl w-full bg-white max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-700 mb-4 sm:mb-6 text-center">
              Importar Alumnos desde CSV
            </h2>

            <div className="mb-6 p-4 neu-card">
              <h3 className="font-semibold text-gray-700 mb-2 text-sm sm:text-base">
                Descargar Plantilla
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mb-3">
                Descarga la plantilla CSV de ejemplo para asegurarte de que tu archivo tenga el formato correcto.
              </p>
              <button 
                onClick={generateCSVTemplate} 
                className="neu-button text-gray-700 font-medium py-2 px-4 text-xs sm:text-sm w-full sm:w-auto"
              >
                📥 Descargar plantilla_alumnos.csv
              </button>
            </div>

            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-colors duration-200 cursor-pointer ${
                isDragActive 
                  ? 'border-blue-400 bg-blue-50' 
                  : csvFile 
                  ? 'border-green-400 bg-green-50' 
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              <input {...getInputProps()} />
              {csvFile ? (
                <div className="space-y-2">
                  <div className="text-3xl sm:text-4xl">📄</div>
                  <p className="text-base sm:text-lg font-medium text-green-700">
                    Archivo seleccionado
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 break-all">{csvFile.name}</p>
                  <p className="text-xs text-gray-500">
                    Tamaño: {(csvFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-3xl sm:text-4xl text-gray-400">📎</div>
                  {isDragActive ? (
                    <p className="text-base sm:text-lg text-blue-600">
                      Suelta el archivo CSV aquí...
                    </p>
                  ) : (
                    <>
                      <p className="text-base sm:text-lg text-gray-600">
                        Arrastra y suelta tu archivo CSV aquí
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500">
                        o haz clic para seleccionar un archivo
                      </p>
                    </>
                  )}
                  <p className="text-xs text-gray-400 mt-2">Solo se permiten archivos .csv</p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6">
              <button 
                type="button" 
                onClick={() => { 
                  setIsCSVModalOpen(false)
                  setCSVFile(null)
                }} 
                className="flex-1 neu-button text-gray-700 font-semibold py-3 px-4 text-sm sm:text-base" 
                disabled={isProcessingCSV}
              >
                Cancelar
              </button>
              {csvFile && (
                <button 
                  onClick={() => setCSVFile(null)} 
                  className="neu-button text-gray-700 font-medium py-3 px-4 text-sm sm:text-base" 
                  disabled={isProcessingCSV}
                >
                  🗑️ Quitar
                </button>
              )}
              <button 
                onClick={handleCSVUpload} 
                disabled={!csvFile || isProcessingCSV} 
                className={`flex-1 font-semibold py-3 px-4 text-sm sm:text-base ${
                  !csvFile || isProcessingCSV 
                    ? 'neu-button text-gray-400 cursor-not-allowed opacity-50' 
                    : 'neu-button text-gray-700'
                }`}
              >
                {isProcessingCSV ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 mr-2"></div>
                    Procesando...
                  </span>
                ) : (
                  '📤 Importar Alumnos'
                )}
              </button>
            </div>

            <div className="mt-6 p-4 neu-card bg-blue-50/30">
              <h4 className="font-medium text-gray-700 mb-2 text-sm sm:text-base">
                Formato requerido:
              </h4>
              <ul className="text-xs sm:text-sm text-gray-600 space-y-1">
                <li>• <strong>full_name:</strong> Nombre y apellidos del alumno</li>
                <li>• <strong>student_email:</strong> Correo electrónico del estudiante</li>
                <li>• <strong>tutor_email:</strong> Correo electrónico del padre/madre/tutor</li>
              </ul>
              <p className="text-xs text-gray-500 mt-3">
                💡 Tip: La primera fila debe contener exactamente estos encabezados
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}