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
    <div className="p-8">
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
      <div className="bg-gray-200/60 backdrop-blur-sm rounded-xl p-6 shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-700">Exámenes</h2>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl shadow-[6px_6px_12px_#d1d9e6,-6px_-6px_12px_#ffffff] active:shadow-inner-[2px_2px_4px_#d1d9e6,-2px_-2px_4px_#ffffff] transition-all"
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
              <div key={exam.id} className="bg-gray-200/80 rounded-lg p-4 shadow-[3px_3px_6px_#d1d9e6,-3px_-3px_6px_#ffffff] flex flex-col justify-between">
                <h3 className="font-semibold text-gray-800 mb-4">{exam.name}</h3>
                <Link
                  href={`/dashboard/class/${classId}/exam/${exam.id}`}
                  className="w-full text-center bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg shadow-[3px_3px_6px_#d1d9e6,-3px_-3px_6px_#ffffff] active:shadow-inner-[1px_1px_3px_#d1d9e6,-1px_-1px_3px_#ffffff] transition-all"
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
          <div className="relative bg-gray-200/60 backdrop-blur-md rounded-xl p-8 shadow-lg max-w-lg w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">Crear Nuevo Examen</h2>
            <form onSubmit={handleCreateExam}>
              <div className="mb-4">
                <label htmlFor="examName" className="block text-gray-700 text-sm font-bold mb-2">Nombre del Examen</label>
                <input
                  id="examName"
                  type="text"
                  value={newExamName}
                  onChange={(e) => setNewExamName(e.target.value)}
                  className="w-full bg-gray-200 border-none rounded-lg p-4 text-gray-700 shadow-inner-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Parcial de Álgebra"
                  required
                />
              </div>
              <div className="flex space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff] active:shadow-inner-[2px_2px_4px_#d1d9e6,-2px_-2px_4px_#ffffff]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff] active:shadow-inner-[2px_2px_4px_#d1d9e6,-2px_-2px_4px_#ffffff]"
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