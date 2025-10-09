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
    if (!classId) return;
    const { data, error } = await supabase.from('students').select('*').eq('class_id', classId).order('created_at', { ascending: false });
    if (error) console.error("Error al cargar los estudiantes:", error);
    else setStudents(data || []);
  }, [classId, supabase]);

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

  if (loading) { return <div>Cargando...</div>; }
  if (!classDetails) { return <div>Clase no encontrada.</div>; }

  return (
    <div className="p-8">
      {/* ... (el JSX se mantiene igual que en el bloque de código original que me pasaste) ... */}
    </div>
  );
}