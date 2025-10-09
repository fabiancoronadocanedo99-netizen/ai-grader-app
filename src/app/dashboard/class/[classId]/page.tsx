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
    console.log("Iniciando fetchStudents..."); // <-- ESPÍA AÑADIDO
    if (!classId) return;
    const { data, error } = await supabase.from('students').select('*').eq('class_id', classId).order('created_at', { ascending: false });
    if (error) {
      console.error("¡ERROR al cargar estudiantes!:", error); // <-- ESPÍA AÑADIDO
    } else {
      console.log("¡ÉXITO al cargar estudiantes!:", data); // <-- ESPÍA AÑADIDO
      setStudents(data || []);
    }
  }, [classId, supabase]);

  const fetchEvaluations = useCallback(async () => {
    console.log("Iniciando fetchEvaluations..."); // <-- ESPÍA AÑADIDO
    if (!classId) return;
    const { data, error } = await supabase.from('exams').select('*').eq('class_id', classId).order('created_at', { ascending: false });
    if (error) {
      console.error("¡ERROR al cargar evaluaciones!:", error); // <-- ESPÍA AÑADIDO
    } else {
      console.log("¡ÉXITO al cargar evaluaciones!:", data); // <-- ESPÍA AÑADIDO
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

  // ... (el resto del código se mantiene exactamente igual) ...

  // (Aquí iría todo el resto del código que ya tenías)
}