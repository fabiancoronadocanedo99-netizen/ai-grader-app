'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { createClient } from '@/lib/supabaseClient'

// --- INTERFACES ---
interface ClassDetails { id: string; name: string; subject?: string; grade_level?: string; }
interface Evaluation { id: string; name: string; class_id: string; created_at?: string; type: 'exam' | 'assignment'; } 
interface Student { id: string; full_name: string; student_email: string; tutor_email?: string; class_id: string; created_at?: string; }

export default function ClassDetailPage() {
  const supabase = createClient();
  const params = useParams();
  const classId = params.classId as string;

  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [allEvaluations, setAllEvaluations] = useState<Evaluation[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newEvaluationName, setNewEvaluationName] = useState('');
  const [newEvaluationType, setNewEvaluationType] = useState<'exam' | 'assignment'>('exam');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [evaluationToDelete, setEvaluationToDelete] = useState<Evaluation | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [evaluationToEdit, setEvaluationToEdit] = useState<Evaluation | null>(null);
  const [editingEvaluationName, setEditingEvaluationName] = useState('');
  const [activeTab, setActiveTab] = useState<'evaluations' | 'students'>('evaluations');
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
  const [csvFile, setCSVFile] = useState<File | null>(null);
  const [isProcessingCSV, setIsProcessingCSV] = useState(false);

  const exams = useMemo(() => allEvaluations.filter(e => e.type === 'exam'), [allEvaluations]);
  const assignments = useMemo(() => allEvaluations.filter(e => e.type === 'assignment'), [allEvaluations]);

  const fetchClassDetails = useCallback(async () => {
    console.log("Iniciando fetchClassDetails con classId:", classId);
    if (!classId) {
      console.log("No hay classId, deteniendo.");
      return;
    }
    const { data, error } = await supabase.from('classes').select('*').eq('id', classId).single();
    if (error) {
      console.error("¡ERROR al cargar detalles de la clase!:", error);
    } else {
      console.log("¡ÉXITO! Detalles de la clase encontrados:", data);
      setClassDetails(data);
    }
  }, [classId, supabase]);

  const fetchStudents = useCallback(async () => {
    console.log("Iniciando fetchStudents...");
    if (!classId) return;
    const { data, error } = await supabase.from('students').select('*').eq('class_id', classId).order('created_at', { ascending: false });
    if (error) {
      console.error("¡ERROR al cargar estudiantes!:", error);
    } else {
      console.log("¡ÉXITO al cargar estudiantes!:", data);
      setStudents(data || []);
    }
  }, [classId, supabase]);

  const fetchEvaluations = useCallback(async () => {
    console.log("Iniciando fetchEvaluations...");
    if (!classId) return;
    const { data, error } = await supabase.from('exams').select('*').eq('class_id', classId).order('created_at', { ascending: false });
    if (error) {
      console.error("¡ERROR al cargar evaluaciones!:", error);
    } else {
      console.log("¡ÉXITO al cargar evaluaciones!:", data);
      setAllEvaluations(data as Evaluation[] || []);
    }
  }, [classId, supabase]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchClassDetails(), fetchEvaluations(), fetchStudents()]);
      setLoading(false);
    };
    if (classId) loadData();
  }, [classId, fetchClassDetails, fetchEvaluations, fetchStudents]);

  const handleCreateEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvaluationName.trim() || !classId) return;
    const { error } = await supabase.from('exams').insert([{ name: newEvaluationName, class_id: classId, type: newEvaluationType }]);
    if (error) { alert(`Error: ${error.message}`); }
    else { setNewEvaluationName(''); setNewEvaluationType('exam'); setIsCreateModalOpen(false); await fetchEvaluations(); }
  };

  const handleDeleteEvaluation = async () => {
    if (!evaluationToDelete) return;
    const { error } = await supabase.from('exams').delete().eq('id', evaluationToDelete.id);
    if (error) { alert(`Error: ${error.message}`); }
    else { setIsDeleteModalOpen(false); setEvaluationToDelete(null); await fetchEvaluations(); }
  };

  const handleEditEvaluationName = async (e: React.FormEvent) => {
    if (!evaluationToEdit || !editingEvaluationName.trim()) return;
    const { error } = await supabase.from('exams').update({ name: editingEvaluationName }).eq('id', evaluationToEdit.id);
    if (error) { alert(`Error: ${error.message}`); }
    else { setIsEditModalOpen(false); setEvaluationToEdit(null); setEditingEvaluationName(''); await fetchEvaluations(); }
  };

  const openDeleteModal = (evaluation: Evaluation) => { setEvaluationToDelete(evaluation); setIsDeleteModalOpen(true); setOpenDropdown(null); };
  const openEditModal = (evaluation: Evaluation) => { setEvaluationToEdit(evaluation); setEditingEvaluationName(evaluation.name); setIsEditModalOpen(true); setOpenDropdown(null); };

  const generateCSVTemplate = () => { /* ... tu código para generar CSV ... */ };
  const processCSVFile = async (file: File) => { /* ... tu código para procesar CSV ... */ };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ /* ... */ });
  const handleCSVUpload = () => { if (csvFile) { processCSVFile(csvFile); } };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!classDetails) {
    return <div className="p-8 text-center text-lg text-red-600">Error: Clase no encontrada o no tienes permiso para verla.</div>;
  }

  return (
    <div className="neu-container min-h-screen p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-700 mb-2">{classDetails.name}</h1>
        {classDetails.subject && <p className="text-lg text-gray-600">{classDetails.subject}</p>}
      </div>

      <div className="neu-card p-6">
        <div className="flex border-b border-gray-200 mb-6">
          <button onClick={() => setActiveTab('evaluations')} className={`px-6 py-3 font-semibold ${activeTab === 'evaluations' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>
            Evaluaciones
          </button>
          <button onClick={() => setActiveTab('students')} className={`px-6 py-3 font-semibold ${activeTab === 'students' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>
            Alumnos
          </button>
        </div>

        {activeTab === 'evaluations' && (
          <>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-gray-700">Gestión de Evaluaciones</h2>
              <button onClick={() => setIsCreateModalOpen(true)} className="neu-button text-gray-700 font-semibold py-3 px-6">
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
                      <Link href={`/dashboard/class/${classId}/exam/${exam.id}`} className="neu-button mt-4 text-center block">
                        Gestionar
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-600 mb-4">Homework Tareas</h3>
              {assignments.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No hay tareas para esta clase.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assignments.map(task => (
                    <div key={task.id} className="neu-card p-4">
                      <h4 className="font-semibold text-gray-800">{task.name}</h4>
                      <Link href={`/dashboard/class/${classId}/exam/${task.id}`} className="neu-button mt-4 text-center block">
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
          <div>
            <h2 className="text-2xl font-bold text-gray-700 mb-8">Gestión de Alumnos</h2>
            <p>Aquí irá la tabla de alumnos...</p>
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsCreateModalOpen(false)} />
          <div className="relative neu-card p-8 w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-6 text-center">Crear Nueva Evaluación</h2>
            <form onSubmit={handleCreateEvaluation}>
              <div className="mb-6">
                <label className="block text-sm font-bold mb-3">Tipo de Evaluación</label>
                <div className="flex space-x-2">
                  <button type="button" onClick={() => setNewEvaluationType('exam')} className={`flex-1 py-3 rounded-lg font-semibold ${newEvaluationType === 'exam' ? 'neu-button-active shadow-inner' : 'neu-button'}`}>📝 Examen</button>
                  <button type="button" onClick={() => setNewEvaluationType('assignment')} className={`flex-1 py-3 rounded-lg font-semibold ${newEvaluationType === 'assignment' ? 'neu-button-active shadow-inner' : 'neu-button'}`}>Homework Tarea</button>
                </div>
              </div>
              <div className="mb-4">
                <label htmlFor="evaluationName" className="block text-sm font-bold mb-2">Nombre de la Evaluación</label>
                <input id="evaluationName" type="text" value={newEvaluationName} onChange={(e) => setNewEvaluationName(e.target.value)} className="neu-input w-full p-4" placeholder={newEvaluationType === 'exam' ? "Ej: Parcial de Álgebra" : "Ej: Guía Capítulo 5"} required />
              </div>
              <div className="flex space-x-4 mt-6">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 neu-button">Cancelar</button>
                <button type="submit" className="flex-1 neu-button">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}