'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { createClient } from '@/lib/supabaseClient'

// --- INTERFACES CORREGIDAS (TODO STRING) ---
interface ClassDetails { id: string; name: string; subject?: string; grade_level?: string; }
interface Exam { id: string; name: string; class_id: string; created_at?: string; }
interface Student { id: string; full_name: string; student_email: string; tutor_email?: string; class_id: string; created_at?: string; }

export default function ClassDetailPage() {
  const supabase = createClient();
  const params = useParams()
  const classId = params.classId as string;

  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null)
  const [exams, setExams] = useState<Exam[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newExamName, setNewExamName] = useState('')
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [examToEdit, setExamToEdit] = useState<Exam | null>(null)
  const [editingExamName, setEditingExamName] = useState('')
  const [activeTab, setActiveTab] = useState<'exams' | 'students'>('students')
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false)
  const [isProcessingCSV, setIsProcessingCSV] = useState(false)
  const [csvFile, setCSVFile] = useState<File | null>(null)

  const fetchClassDetails = useCallback(async () => {
    if (!classId) return;
    const { data, error } = await supabase.from('classes').select('*').eq('id', classId).single()
    if (error) console.error("Error al cargar detalles de la clase:", error)
    else setClassDetails(data)
  }, [classId, supabase])

  const fetchExams = useCallback(async () => {
    if (!classId) return;
    const { data, error } = await supabase.from('exams').select('*').eq('class_id', classId).order('created_at', { ascending: false })
    if (error) console.error("Error al cargar los exámenes:", error)
    else setExams(data || [])
  }, [classId, supabase])

  const fetchStudents = useCallback(async () => {
    if (!classId) return;
    const { data, error } = await supabase.from('students').select('*').eq('class_id', classId).order('created_at', { ascending: false })
    if (error) console.error("Error al cargar los estudiantes:", error)
    else setStudents(data || [])
  }, [classId, supabase])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchClassDetails(), fetchExams(), fetchStudents()])
      setLoading(false)
    }
    if (classId){
      loadData()
    }
  }, [classId, fetchClassDetails, fetchExams, fetchStudents])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown !== null) { setOpenDropdown(null) }
    }
    if (openDropdown !== null) { document.addEventListener('mousedown', handleClickOutside) }
    return () => { document.removeEventListener('mousedown', handleClickOutside) }
  }, [openDropdown])

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamName.trim() || !classId) return;
    const { error } = await supabase.from('exams').insert([{ name: newExamName, class_id: classId }]).select();
    if (error) { alert(`Error al crear el examen: ${error.message}`); }
    else { setNewExamName(''); setIsModalOpen(false); await fetchExams(); }
  };

  const handleDeleteExam = async () => {
    if (!examToDelete) return;
    const { error } = await supabase.from('exams').delete().eq('id', examToDelete.id);
    if (error) { alert(`Error al eliminar el examen: ${error.message}`); }
    else { setIsDeleteModalOpen(false); setExamToDelete(null); await fetchExams(); }
  };

  const handleEditExamName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examToEdit || !editingExamName.trim()) return;
    const { error } = await supabase.from('exams').update({ name: editingExamName }).eq('id', examToEdit.id);
    if (error) { alert(`Error al actualizar el examen: ${error.message}`); }
    else { setIsEditModalOpen(false); setExamToEdit(null); setEditingExamName(''); await fetchExams(); }
  };

  const openDeleteModal = (exam: Exam) => { setExamToDelete(exam); setIsDeleteModalOpen(true); setOpenDropdown(null); };
  const openEditModal = (exam: Exam) => { setExamToEdit(exam); setEditingExamName(exam.name); setIsEditModalOpen(true); setOpenDropdown(null); };

  const generateCSVTemplate = () => {
    const csvContent = 'full_name,student_email,tutor_email\nJuan Pérez,juan.perez@estudiante.com,maria.perez@tutor.com\nAna García,ana.garcia@estudiante.com,carlos.garcia@tutor.com';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'plantilla_alumnos.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const processCSVFile = async (file: File) => {
    setIsProcessingCSV(true);
    try {
      const text = await file.text();
      const session = await supabase.auth.getSession();
      const response = await fetch('/api/process-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.data.session?.access_token}` },
        body: JSON.stringify({ csvData: text, classId: classId })
      });
      const result = await response.json();
      if (!response.ok) { throw new Error(result.error || 'Error desconocido del servidor'); }
      alert(`CSV procesado exitosamente. Se agregaron ${result.studentsAdded || 0} alumnos.`);
      setIsCSVModalOpen(false);
      setCSVFile(null);
      await fetchStudents();
    } catch (error) {
      console.error('Error al procesar CSV:', error);
      alert(`Error al procesar el archivo CSV: ${(error as Error).message}`);
    } finally {
      setIsProcessingCSV(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    onDrop: (acceptedFiles) => { if (acceptedFiles.length > 0) { setCSVFile(acceptedFiles[0]); } }
  });

  const handleCSVUpload = () => { if (csvFile) { processCSVFile(csvFile); } };

  if (loading) { return <div className="p-8 text-center text-gray-600">Cargando...</div>; }
  if (!classDetails) { return <div className="p-8 text-center text-gray-600">No se pudo encontrar la clase.</div>; }

  return (
    <div className="neu-container min-h-screen p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-700 mb-2">{classDetails.name}</h1>
        {classDetails.subject && classDetails.grade_level && (
          <p className="text-lg text-gray-600">{classDetails.subject} - {classDetails.grade_level}</p>
        )}
      </div>
      <div className="neu-card p-6">
        <div className="flex space-x-1 mb-8">
          <button onClick={() => setActiveTab('exams')} className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${activeTab === 'exams' ? 'neu-button-active text-gray-700 shadow-inner' : 'neu-button text-gray-600 hover:text-gray-700'}`}>Exámenes</button>
          <button onClick={() => setActiveTab('students')} className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${activeTab === 'students' ? 'neu-button-active text-gray-700 shadow-inner' : 'neu-button text-gray-600 hover:text-gray-700'}`}>Alumnos</button>
        </div>
        {activeTab === 'exams' && (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-700">Exámenes</h2>
              <button onClick={() => setIsModalOpen(true)} className="neu-button text-gray-700 font-semibold py-3 px-6">Crear Nuevo Examen</button>
            </div>
            {exams.length === 0 ? (
              <p className="text-center text-gray-600">Aún no hay exámenes para esta clase</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exams.map((exam) => (
                  <div key={exam.id} className="neu-card p-4 flex flex-col justify-between relative">
                    <div className="absolute top-2 right-2"><button onClick={() => setOpenDropdown(openDropdown === exam.id ? null : exam.id)} className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200" title="Opciones"><div className="flex flex-col space-y-1"><div className="w-1 h-1 bg-gray-500 rounded-full"></div><div className="w-1 h-1 bg-gray-500 rounded-full"></div><div className="w-1 h-1 bg-gray-500 rounded-full"></div></div></button>{openDropdown === exam.id && (<div className="absolute right-0 top-10 neu-card p-2 min-w-[150px] z-20"><button onClick={() => openEditModal(exam)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors duration-200">Editar Nombre</button><button onClick={() => openDeleteModal(exam)} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors duration-200">Eliminar</button></div>)}</div>
                    <h3 className="font-semibold text-gray-800 mb-4 pr-8">{exam.name}</h3>
                    <Link href={`/dashboard/class/${classId}/exam/${exam.id}`} className="w-full text-center neu-button text-gray-700 font-medium py-2 px-4">Gestionar</Link>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {activeTab === 'students' && (
          <>
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-gray-700">Alumnos</h2><div className="flex space-x-4"><button className="neu-button text-gray-700 font-semibold py-3 px-6">Añadir Alumno Manualmente</button><button onClick={() => setIsCSVModalOpen(true)} className="neu-button text-gray-700 font-semibold py-3 px-6">Importar CSV</button></div></div>
            <div className="neu-card p-4"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-gray-200"><th className="text-left py-4 px-4 font-semibold text-gray-700">Nombre Completo</th><th className="text-left py-4 px-4 font-semibold text-gray-700">Email Alumno</th><th className="text-left py-4 px-4 font-semibold text-gray-700">Email Tutor</th><th className="text-left py-4 px-4 font-semibold text-gray-700">Acciones</th></tr></thead><tbody>{students.length === 0 ? (<tr><td colSpan={4} className="text-center py-12 text-gray-600">Aun no hay alumnos en esta clase</td></tr>) : (students.map((student) => (<tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50/50"><td className="py-4 px-4 text-gray-700">{student.full_name}</td><td className="py-4 px-4 text-gray-600">{student.student_email}</td><td className="py-4 px-4 text-gray-600">{student.tutor_email || 'No especificado'}</td><td className="py-4 px-4"><div className="flex space-x-2"><button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Editar</button><button className="text-red-600 hover:text-red-800 text-sm font-medium">Eliminar</button></div></td></tr>)))}</tbody></table></div></div>
          </>
        )}
      </div>
      {isModalOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center"><div className="absolute inset-0 bg-black/50" onClick={() => setIsModalOpen(false)} /><div className="relative neu-card p-8 max-w-lg w-full mx-4"><h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">Crear Nuevo Examen</h2><form onSubmit={handleCreateExam}><div className="mb-4"><label htmlFor="examName" className="block text-gray-700 text-sm font-bold mb-2">Nombre del Examen</label><input id="examName" type="text" value={newExamName} onChange={(e) => setNewExamName(e.target.value)} className="neu-input w-full p-4 text-gray-700 placeholder-gray-500" placeholder="Ej: Parcial de Álgebra" required /></div><div className="flex space-x-4 mt-6"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 neu-button text-gray-700 font-semibold py-3 px-4">Cancelar</button><button type="submit" className="flex-1 neu-button text-gray-700 font-semibold py-3 px-4">Crear</button></div></form></div></div>)}
      {isDeleteModalOpen && examToDelete && (<div className="fixed inset-0 z-50 flex items-center justify-center"><div className="absolute inset-0 bg-black/50" onClick={() => setIsDeleteModalOpen(false)} /><div className="relative neu-card p-8 max-w-lg w-full mx-4"><h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">Confirmar Eliminación</h2><p className="text-gray-600 mb-6 text-center">¿Estás seguro de que deseas eliminar el examen "{examToDelete.name}"? Esta acción no se puede deshacer.</p><div className="flex space-x-4"><button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 neu-button text-gray-700 font-semibold py-3 px-4">Cancelar</button><button onClick={handleDeleteExam} className="flex-1 neu-button bg-red-50 text-red-700 hover:bg-red-100 font-semibold py-3 px-4">Eliminar</button></div></div></div>)}
      {isEditModalOpen && examToEdit && (<div className="fixed inset-0 z-50 flex items-center justify-center"><div className="absolute inset-0 bg-black/50" onClick={() => setIsEditModalOpen(false)} /><div className="relative neu-card p-8 max-w-lg w-full mx-4"><h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">Editar Nombre del Examen</h2><form onSubmit={handleEditExamName}><div className="mb-4"><label htmlFor="editExamName" className="block text-gray-700 text-sm font-bold mb-2">Nuevo nombre</label><input id="editExamName" type="text" value={editingExamName} onChange={(e) => setEditingExamName(e.target.value)} className="neu-input w-full p-4 text-gray-700 placeholder-gray-500" placeholder="Nuevo nombre del examen" required autoFocus /></div><div className="flex space-x-4 mt-6"><button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 neu-button text-gray-700 font-semibold py-3 px-4">Cancelar</button><button type="submit" className="flex-1 neu-button text-gray-700 font-semibold py-3 px-4">Guardar</button></div></form></div></div>)}
      {isCSVModalOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center"><div className="absolute inset-0 bg-black/50" onClick={() => setIsCSVModalOpen(false)} /><div className="relative neu-card p-8 max-w-2xl w-full mx-4"><h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">Importar Alumnos desde CSV</h2><div className="mb-6 p-4 neu-card"><h3 className="font-semibold text-gray-700 mb-2">Descargar Plantilla</h3><p className="text-sm text-gray-600 mb-3">Descarga la plantilla CSV de ejemplo para asegurarte de que tu archivo tenga el formato correcto.</p><button onClick={generateCSVTemplate} className="neu-button text-gray-700 font-medium py-2 px-4 text-sm">📥 Descargar plantilla_alumnos.csv</button></div><div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 cursor-pointer ${isDragActive ? 'border-blue-400 bg-blue-50' : csvFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}><input {...getInputProps()} />{csvFile ? (<div className="space-y-2"><div className="text-4xl">📄</div><p className="text-lg font-medium text-green-700">Archivo seleccionado</p><p className="text-sm text-gray-600">{csvFile.name}</p><p className="text-xs text-gray-500">Tamaño: {(csvFile.size / 1024).toFixed(2)} KB</p></div>) : (<div className="space-y-2"><div className="text-4xl text-gray-400">📎</div>{isDragActive ? (<p className="text-lg text-blue-600">Suelta el archivo CSV aquí...</p>) : (<><p className="text-lg text-gray-600">Arrastra y suelta tu archivo CSV aquí</p><p className="text-sm text-gray-500">o haz clic para seleccionar un archivo</p></>)}<p className="text-xs text-gray-400 mt-2">Solo se permiten archivos .csv (máximo 1 archivo)</p></div>)}</div><div className="flex space-x-4 mt-6"><button type="button" onClick={() => { setIsCSVModalOpen(false); setCSVFile(null); }} className="flex-1 neu-button text-gray-700 font-semibold py-3 px-4" disabled={isProcessingCSV}>Cancelar</button>{csvFile && (<button onClick={() => setCSVFile(null)} className="neu-button text-gray-700 font-medium py-3 px-4" disabled={isProcessingCSV}>🗑️ Quitar archivo</button>)}<button onClick={handleCSVUpload} disabled={!csvFile || isProcessingCSV} className={`flex-1 font-semibold py-3 px-4 ${!csvFile || isProcessingCSV ? 'neu-button text-gray-400 cursor-not-allowed opacity-50' : 'neu-button text-gray-700'}`}>{isProcessingCSV ? (<span className="flex items-center justify-center"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 mr-2"></div>Procesando...</span>) : ('📤 Importar Alumnos')}</button></div><div className="mt-6 p-4 neu-card bg-blue-50/30"><h4 className="font-medium text-gray-700 mb-2">Formato requerido:</h4><ul className="text-sm text-gray-600 space-y-1"><li>• <strong>Nombre Completo:</strong> Nombre y apellidos del alumno</li><li>• <strong>Email Alumno:</strong> Correo electrónico del estudiante</li><li>• <strong>Email Tutor:</strong> Correo electrónico del padre/madre/tutor</li></ul><p className="text-xs text-gray-500 mt-3">💡 Tip: La primera fila debe contener los encabezados de las columnas</p></div></div></div>)}
    </div>
  );
}