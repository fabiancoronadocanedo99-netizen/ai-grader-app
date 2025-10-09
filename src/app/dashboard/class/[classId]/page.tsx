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
  // ... (otros estados se mantienen)

  const exams = useMemo(() => allEvaluations.filter(e => e.type === 'exam'), [allEvaluations]);
  const assignments = useMemo(() => allEvaluations.filter(e => e.type === 'assignment'), [allEvaluations]);

  const fetchClassDetails = useCallback(async () => { /* ... se mantiene igual ... */ }, [classId, supabase]);
  const fetchStudents = useCallback(async () => { /* ... se mantiene igual ... */ }, [classId, supabase]);

  const fetchEvaluations = useCallback(async () => {
    if (!classId) return;
    const { data, error } = await supabase.from('exams').select('*').eq('class_id', classId).order('created_at', { ascending: false });
    if (error) console.error("Error al cargar las evaluaciones:", error);
    else setAllEvaluations(data as Evaluation[] || []);
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

  // ... (resto de funciones se mantienen)

  if (loading) { return <div>Cargando...</div>; }
  if (!classDetails) { return <div>Clase no encontrada.</div>; }

  return (
    <div className="p-8">
      {/* ... (código del header y pestañas se mantiene igual, pero cambia setActiveTab('evaluations')) ... */}

      {activeTab === 'evaluations' && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-700">Evaluaciones</h2>
            <button onClick={() => setIsCreateModalOpen(true)} className="neu-button">Crear Nueva Evaluación</button>
          </div>

          <section className="mb-12">
            <h3 className="text-xl font-semibold">📝 Exámenes</h3>
            {exams.length > 0 ? exams.map(exam => (
              <div key={exam.id} className="neu-card p-4 my-2">
                {exam.name}
                {/* Aquí iría el botón de opciones que llama a openEditModal(exam) y openDeleteModal(exam) */}
              </div>
            )) : <p>No hay exámenes.</p>}
          </section>

          <section>
            <h3 className="text-xl font-semibold">Homework Tareas</h3>
            {assignments.length > 0 ? assignments.map(task => (
              <div key={task.id} className="neu-card p-4 my-2">
                {task.name}
                {/* Aquí iría el botón de opciones que llama a openEditModal(task) y openDeleteModal(task) */}
              </div>
            )) : <p>No hay tareas.</p>}
          </section>
        </>
      )}

      {/* ... (la pestaña de alumnos se mantiene igual) ... */}

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" />
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

      {/* ... (los otros modales de editar/eliminar se mantienen igual) ... */}
    </div>
  );
}