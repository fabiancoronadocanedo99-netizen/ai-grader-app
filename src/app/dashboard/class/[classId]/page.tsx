'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'

// Interfaces para los tipos de datos
interface ClassDetails {
  id: number;
  name: string;
  subject?: string;
  grade_level?: string;
}

interface Exam {
  id: number;
  name: string;
  class_id: number;
  created_at?: string;
}

export default function ClassDetailPage() {
  const params = useParams()
  const classId = parseInt(params.classId as string, 10)

  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null)
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newExamName, setNewExamName] = useState('')

  // Función para obtener los detalles de la clase
  const fetchClassDetails = useCallback(async () => {
    if (isNaN(classId)) return
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('id', classId)
      .single()
    if (error) {
      console.error("Error al cargar detalles de la clase:", error)
    } else {
      setClassDetails(data)
    }
  }, [classId])

  // Función para obtener los exámenes de la clase
  const fetchExams = useCallback(async () => {
    if (isNaN(classId)) return
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
    if (error) {
      console.error("Error al cargar los exámenes:", error)
    } else {
      setExams(data || [])
    }
  }, [classId])

  // useEffect para cargar todos los datos al inicio
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await fetchClassDetails()
      await fetchExams()
      setLoading(false)
    }
    if (!isNaN(classId)) {
      loadData()
    }
  }, [classId, fetchClassDetails, fetchExams])
  
  // Función para crear un nuevo examen
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamName.trim() || isNaN(classId)) return;

    const { data, error } = await supabase
      .from('exams')
      .insert([{ name: newExamName, class_id: classId }])
      .select();

    if (error) {
      alert(`Error al crear el examen: ${error.message}`);
    } else {
      setNewExamName('');
      setIsModalOpen(false);
      await fetchExams(); // Refrescar la lista de exámenes
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Cargando...</div>;
  }
  
  if (!classDetails) {
    return <div className="p-8 text-center text-gray-600">No se pudo encontrar la clase.</div>;
  }

  return (
    <div className="neu-container min-h-screen p-8">
      {/* Encabezado de la Clase */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-700 mb-2">{classDetails.name}</h1>
        {classDetails.subject && classDetails.grade_level && (
          <p className="text-lg text-gray-600">
            {classDetails.subject} - {classDetails.grade_level}
          </p>
        )}
      </div>

      {/* Sección de Exámenes */}
      <div className="neu-card p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-700">Exámenes</h2>
          <button
            onClick={() => setIsModalOpen(true)}
            className="neu-button text-gray-700 font-semibold py-3 px-6"
          >
            Crear Nuevo Examen
          </button>
        </div>

        {/* Lista de Exámenes */}
        {exams.length === 0 ? (
          <p className="text-center text-gray-600">Aún no hay exámenes para esta clase</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam) => (
              <div key={exam.id} className="neu-card p-4 flex flex-col justify-between">
                <h3 className="font-semibold text-gray-800 mb-4">{exam.name}</h3>
                <Link
                  href={`/dashboard/class/${classId}/exam/${exam.id}`}
                  className="w-full text-center neu-button text-gray-700 font-medium py-2 px-4"
                >
                  Gestionar
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal para Crear Nuevo Examen */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsModalOpen(false)} />
          <div className="relative neu-card p-8 max-w-lg w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">Crear Nuevo Examen</h2>
            <form onSubmit={handleCreateExam}>
              <div className="mb-4">
                <label htmlFor="examName" className="block text-gray-700 text-sm font-bold mb-2">Nombre del Examen</label>
                <input
                  id="examName"
                  type="text"
                  value={newExamName}
                  onChange={(e) => setNewExamName(e.target.value)}
                  className="neu-input w-full p-4 text-gray-700 placeholder-gray-500"
                  placeholder="Ej: Parcial de Álgebra"
                  required
                />
              </div>
              <div className="flex space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 neu-button text-gray-700 font-semibold py-3 px-4"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 neu-button text-gray-700 font-semibold py-3 px-4"
                >
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}