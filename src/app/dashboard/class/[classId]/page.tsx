'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useDropzone, FileWithPath } from 'react-dropzone'
import { createClient } from '@/lib/supabaseClient'

// --- INTERFACES ---
interface ClassDetails { id: string; name: string; subject?: string; grade_level?: string; }
interface Evaluation { id: string; name: string; class_id: string; created_at?: string; type: 'exam' | 'assignment'; } 
interface Student { id: string; full_name: string; student_email: string; tutor_email?: string; class_id: string; created_at?: string; }

export default function ClassDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const classId = params.classId as string

  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null)
  const [allEvaluations, setAllEvaluations] = useState<Evaluation[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  // Tabs
  const [activeTab, setActiveTab] = useState<'evaluations' | 'students'>('evaluations')

  // Modal Crear
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newEvaluationName, setNewEvaluationName] = useState('')
  const [newEvaluationType, setNewEvaluationType] = useState<'exam' | 'assignment'>('exam')

  // CSV
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false)
  const [csvFile, setCSVFile] = useState<File | null>(null)
  const [isProcessingCSV, setIsProcessingCSV] = useState(false)

  // --- ESTADOS NUEVOS PARA EDITAR/ELIMINAR ---
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null) // Menú desplegable activo

  // Eliminar
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [evalToDelete, setEvalToDelete] = useState<Evaluation | null>(null)

  // Editar
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [evalToEdit, setEvalToEdit] = useState<Evaluation | null>(null)
  const [editName, setEditName] = useState('')

  const exams = useMemo(() => allEvaluations.filter(e => e.type === 'exam'), [allEvaluations])
  const assignments = useMemo(() => allEvaluations.filter(e => e.type === 'assignment'), [allEvaluations])

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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchClassDetails(), fetchEvaluations(), fetchStudents()])
      setLoading(false)
    }
    if (classId) loadData()
  }, [classId, fetchClassDetails, fetchEvaluations, fetchStudents])

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

  // Manejar Eliminar
  const handleDeleteClick = (e: React.MouseEvent, evaluation: Evaluation) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMenuId(null);
    setEvalToDelete(evaluation);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!evalToDelete) return;

    // Nota: Usamos la tabla 'exams' porque ahí se guardan tanto exámenes como tareas (campo type)
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

  // Manejar Editar
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

  // --- CREACIÓN ---
  const handleCreateEvaluation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEvaluationName.trim() || !classId) return
    const { error } = await supabase.from('exams').insert([{ name: newEvaluationName, class_id: classId, type: newEvaluationType }])
    if (error) { alert(`Error: ${error.message}`) } 
    else {
      setNewEvaluationName('')
      setNewEvaluationType('exam')
      setIsCreateModalOpen(false)
      await fetchEvaluations()
    }
  }

  // --- CSV ---
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
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!classDetails) {
    return (
      <div className="p-8 text-center text-lg text-red-600">
        Error: Clase no encontrada o no tienes permiso para verla.
      </div>
    )
  }

  // Componente reutilizable para el menú en las tarjetas
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
    <div className="neu-container min-h-screen p-8">
      {/* --- BOTÓN VOLVER (NUEVO) --- */}
      <div className="mb-6">
        <Link 
          href="/dashboard"
          className="neu-button inline-flex items-center text-gray-700 font-medium py-2 px-4 text-sm"
        >
          ← Volver al Dashboard
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-700 mb-2">{classDetails.name}</h1>
        {classDetails.subject && <p className="text-lg text-gray-600">{classDetails.subject}</p>}
      </div>

      <div className="neu-card p-6">
        <div className="flex border-b border-gray-200 mb-6">
          <button 
            onClick={() => setActiveTab('evaluations')} 
            className={`px-6 py-3 font-semibold ${
              activeTab === 'evaluations' 
                ? 'border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-500'
            }`}
          >
            Evaluaciones
          </button>
          <button 
            onClick={() => setActiveTab('students')} 
            className={`px-6 py-3 font-semibold ${
              activeTab === 'students' 
                ? 'border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-500'
            }`}
          >
            Alumnos
          </button>
          <Link 
            href={`/dashboard/class/${classId}/analytics`} 
            className="px-6 py-3 font-semibold text-gray-500 hover:text-blue-600"
          >
            📊 Analíticas
          </Link>
        </div>

        {activeTab === 'evaluations' && (
          <>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-gray-700">Gestión de Evaluaciones</h2>
              <button 
                onClick={() => setIsCreateModalOpen(true)} 
                className="neu-button text-gray-700 font-semibold py-3 px-6"
              >
                Crear Nueva Evaluación
              </button>
            </div>

            <section className="mb-10">
              <h3 className="text-xl font-semibold text-gray-600 mb-4">📝 Exámenes</h3>
              {exams.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No hay exámenes para esta clase.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {exams.map(exam => (
                    <div key={exam.id} className="neu-card p-4 relative">
                      <EvaluationCardMenu item={exam} />

                      <div className="pr-8"> {/* Padding para no chocar con el menú */}
                         <h4 className="font-semibold text-gray-800 text-lg mb-4">{exam.name}</h4>
                      </div>

                      <Link 
                        href={`/dashboard/class/${classId}/exam/${exam.id}`} 
                        className="neu-button mt-2 text-center block"
                      >
                        Gestionar
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-600 mb-4">📚 Tareas</h3>
              {assignments.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No hay tareas para esta clase.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assignments.map(task => (
                    <div key={task.id} className="neu-card p-4 relative">
                       <EvaluationCardMenu item={task} />

                      <div className="pr-8">
                        <h4 className="font-semibold text-gray-800 text-lg mb-4">{task.name}</h4>
                      </div>

                      <Link 
                        href={`/dashboard/class/${classId}/exam/${task.id}`} 
                        className="neu-button mt-2 text-center block"
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
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-700">Gestión de Alumnos</h2>
              <button 
                onClick={() => setIsCSVModalOpen(true)} 
                className="neu-button text-gray-700 font-semibold py-3 px-6"
              >
                📤 Importar CSV
              </button>
            </div>

            <div className="neu-card p-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">Nombre Completo</th>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">Email Alumno</th>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">Email Tutor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center py-12 text-gray-600">
                          Aún no hay alumnos en esta clase. ¡Impórtalos desde un CSV!
                        </td>
                      </tr>
                    ) : (
                      students.map((student) => (
                        <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                          <td className="py-4 px-4 text-gray-700 font-medium">
                            <Link href={`/dashboard/student/${student.id}`} className="hover:underline text-blue-600">
                              {student.full_name}
                            </Link>
                          </td>
                          <td className="py-4 px-4 text-gray-600">{student.student_email}</td>
                          <td className="py-4 px-4 text-gray-600">{student.tutor_email || 'No especificado'}</td>
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

      {/* --- Modal Crear Evaluación --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setIsCreateModalOpen(false)} 
          />
          <div className="relative neu-card p-8 w-full max-w-lg bg-white">
            <h2 className="text-2xl font-bold mb-6 text-center">Crear Nueva Evaluación</h2>
            <form onSubmit={handleCreateEvaluation}>
              <div className="mb-6">
                <label className="block text-sm font-bold mb-3">Tipo de Evaluación</label>
                <div className="flex space-x-2">
                  <button 
                    type="button" 
                    onClick={() => setNewEvaluationType('exam')} 
                    className={`flex-1 py-3 rounded-lg font-semibold ${
                      newEvaluationType === 'exam' 
                        ? 'neu-button-active shadow-inner' 
                        : 'neu-button'
                    }`}
                  >
                    📝 Examen
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setNewEvaluationType('assignment')} 
                    className={`flex-1 py-3 rounded-lg font-semibold ${
                      newEvaluationType === 'assignment' 
                        ? 'neu-button-active shadow-inner' 
                        : 'neu-button'
                    }`}
                  >
                    📚 Tarea
                  </button>
                </div>
              </div>
              <div className="mb-4">
                <label htmlFor="evaluationName" className="block text-sm font-bold mb-2">
                  Nombre de la Evaluación
                </label>
                <input 
                  id="evaluationName" 
                  type="text" 
                  value={newEvaluationName} 
                  onChange={(e) => setNewEvaluationName(e.target.value)} 
                  className="neu-input w-full p-4" 
                  placeholder={newEvaluationType === 'exam' ? "Ej: Parcial de Álgebra" : "Ej: Guía Capítulo 5"} 
                  required 
                />
              </div>
              <div className="flex space-x-4 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsCreateModalOpen(false)} 
                  className="flex-1 neu-button"
                >
                  Cancelar
                </button>
                <button type="submit" className="flex-1 neu-button">
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal EDITAR Evaluación --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
           <div className="absolute inset-0 bg-black/50" onClick={() => setIsEditModalOpen(false)} />
           <div className="relative neu-card p-6 w-full max-w-md bg-white z-50">
             <h2 className="text-xl font-bold mb-4">Editar Nombre</h2>
             <input
               type="text"
               value={editName}
               onChange={(e) => setEditName(e.target.value)}
               className="neu-input w-full p-3 mb-6"
               placeholder="Nuevo nombre..."
               autoFocus
             />
             <div className="flex justify-end gap-3">
               <button 
                 onClick={() => setIsEditModalOpen(false)}
                 className="neu-button px-4 py-2 text-gray-600 text-sm"
               >
                 Cancelar
               </button>
               <button 
                 onClick={confirmEdit}
                 className="neu-button px-4 py-2 text-blue-600 font-bold text-sm"
               >
                 Guardar
               </button>
             </div>
           </div>
        </div>
      )}

      {/* --- Modal ELIMINAR Evaluación --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
           <div className="absolute inset-0 bg-black/50" onClick={() => setIsDeleteModalOpen(false)} />
           <div className="relative neu-card p-6 w-full max-w-md bg-white z-50">
             <h2 className="text-xl font-bold mb-2 text-red-600">Eliminar Evaluación</h2>
             <p className="text-gray-600 mb-6">
               ¿Estás seguro de que quieres eliminar <strong>{evalToDelete?.name}</strong>? 
               <br/>Se perderán todos los datos asociados.
             </p>
             <div className="flex justify-end gap-3">
               <button 
                 onClick={() => setIsDeleteModalOpen(false)}
                 className="neu-button px-4 py-2 text-gray-600 text-sm"
               >
                 Cancelar
               </button>
               <button 
                 onClick={confirmDelete}
                 className="neu-button px-4 py-2 text-red-600 font-bold text-sm"
               >
                 Eliminar
               </button>
             </div>
           </div>
        </div>
      )}

      {/* --- Modal Importar CSV (Sin cambios lógicos, solo renderizado) --- */}
      {isCSVModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setIsCSVModalOpen(false)} 
          />
          <div className="relative neu-card p-8 max-w-2xl w-full mx-4 bg-white">
            <h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">
              Importar Alumnos desde CSV
            </h2>

            <div className="mb-6 p-4 neu-card">
              <h3 className="font-semibold text-gray-700 mb-2">Descargar Plantilla</h3>
              <p className="text-sm text-gray-600 mb-3">
                Descarga la plantilla CSV de ejemplo para asegurarte de que tu archivo tenga el formato correcto.
              </p>
              <button 
                onClick={generateCSVTemplate} 
                className="neu-button text-gray-700 font-medium py-2 px-4 text-sm"
              >
                📥 Descargar plantilla_alumnos.csv
              </button>
            </div>

            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 cursor-pointer ${
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
                  <div className="text-4xl">📄</div>
                  <p className="text-lg font-medium text-green-700">Archivo seleccionado</p>
                  <p className="text-sm text-gray-600">{csvFile.name}</p>
                  <p className="text-xs text-gray-500">Tamaño: {(csvFile.size / 1024).toFixed(2)} KB</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-4xl text-gray-400">📎</div>
                  {isDragActive ? (
                    <p className="text-lg text-blue-600">Suelta el archivo CSV aquí...</p>
                  ) : (
                    <>
                      <p className="text-lg text-gray-600">Arrastra y suelta tu archivo CSV aquí</p>
                      <p className="text-sm text-gray-500">o haz clic para seleccionar un archivo</p>
                    </>
                  )}
                  <p className="text-xs text-gray-400 mt-2">Solo se permiten archivos .csv</p>
                </div>
              )}
            </div>

            <div className="flex space-x-4 mt-6">
              <button 
                type="button" 
                onClick={() => { 
                  setIsCSVModalOpen(false)
                  setCSVFile(null)
                }} 
                className="flex-1 neu-button text-gray-700 font-semibold py-3 px-4" 
                disabled={isProcessingCSV}
              >
                Cancelar
              </button>
              {csvFile && (
                <button 
                  onClick={() => setCSVFile(null)} 
                  className="neu-button text-gray-700 font-medium py-3 px-4" 
                  disabled={isProcessingCSV}
                >
                  🗑️ Quitar
                </button>
              )}
              <button 
                onClick={handleCSVUpload} 
                disabled={!csvFile || isProcessingCSV} 
                className={`flex-1 font-semibold py-3 px-4 ${
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
              <h4 className="font-medium text-gray-700 mb-2">Formato requerido:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
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