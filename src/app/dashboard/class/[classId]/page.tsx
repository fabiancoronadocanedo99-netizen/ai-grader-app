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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newEvaluationName, setNewEvaluationName] = useState('')
  const [newEvaluationType, setNewEvaluationType] = useState<'exam' | 'assignment'>('exam')
  const [activeTab, setActiveTab] = useState<'evaluations' | 'students'>('evaluations')
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false)
  const [csvFile, setCSVFile] = useState<File | null>(null)
  const [isProcessingCSV, setIsProcessingCSV] = useState(false)

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

      // Forzar refresh de la sesión
      const { data, error: refreshError } = await supabase.auth.refreshSession();

      // --- CORRECCIÓN #1: Hacemos la comprobación más explícita ---
      if (refreshError || !data.session || !data.session.access_token) {
        throw new Error('Por favor, cierra sesión y vuelve a iniciar sesión');
      }

      const session = data.session;

      console.log('✅ Sesión refrescada, token obtenido');

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

      // --- CORRECCIÓN #2: 'response' en minúscula ---
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

  return (
    <div className="neu-container min-h-screen p-8">
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
                    <div key={exam.id} className="neu-card p-4">
                      <h4 className="font-semibold text-gray-800">{exam.name}</h4>
                      <Link 
                        href={`/dashboard/class/${classId}/exam/${exam.id}`} 
                        className="neu-button mt-4 text-center block"
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
                    <div key={task.id} className="neu-card p-4">
                      <h4 className="font-semibold text-gray-800">{task.name}</h4>
                      <Link 
                        href={`/dashboard/class/${classId}/exam/${task.id}`} 
                        className="neu-button mt-4 text-center block"
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
                          <td className="py-4 px-4 text-gray-700">{student.full_name}</td>
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

      {/* Modal Crear Evaluación */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setIsCreateModalOpen(false)} 
          />
          <div className="relative neu-card p-8 w-full max-w-lg">
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

      {/* Modal Importar CSV */}
      {isCSVModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setIsCSVModalOpen(false)} 
          />
          <div className="relative neu-card p-8 max-w-2xl w-full mx-4">
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