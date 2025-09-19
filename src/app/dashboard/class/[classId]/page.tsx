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
  class_id: number; // Revertir a number para compatibilidad
  created_at?: string;
}

export default function ClassDetailPage() {
  const params = useParams()
  const classId = parseInt(params.classId as string, 10) // Revertir a number para compatibilidad

  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null)
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newExamName, setNewExamName] = useState('')

  // Estados para funcionalidad de editar/eliminar exámenes
  const [openDropdown, setOpenDropdown] = useState<number | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [examToEdit, setExamToEdit] = useState<Exam | null>(null)
  const [editingExamName, setEditingExamName] = useState('')
  
  // Estado para el sistema de pestañas
  const [activeTab, setActiveTab] = useState<'exams' | 'students'>('exams')

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

  // useEffect para cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown !== null) {
        setOpenDropdown(null)
      }
    }
    
    if (openDropdown !== null) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openDropdown])
  
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

  // Función para eliminar un examen
  const handleDeleteExam = async () => {
    if (!examToDelete) return;

    const { error } = await supabase
      .from('exams')
      .delete()
      .eq('id', examToDelete.id);

    if (error) {
      alert(`Error al eliminar el examen: ${error.message}`);
    } else {
      setIsDeleteModalOpen(false);
      setExamToDelete(null);
      await fetchExams(); // Refrescar la lista de exámenes
    }
  };

  // Función para editar el nombre de un examen
  const handleEditExamName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examToEdit || !editingExamName.trim()) return;

    const { error } = await supabase
      .from('exams')
      .update({ name: editingExamName })
      .eq('id', examToEdit.id);

    if (error) {
      alert(`Error al actualizar el examen: ${error.message}`);
    } else {
      setIsEditModalOpen(false);
      setExamToEdit(null);
      setEditingExamName('');
      await fetchExams(); // Refrescar la lista de exámenes
    }
  };

  // Función para abrir modal de eliminación
  const openDeleteModal = (exam: Exam) => {
    setExamToDelete(exam);
    setIsDeleteModalOpen(true);
    setOpenDropdown(null);
  };

  // Función para abrir modal de edición
  const openEditModal = (exam: Exam) => {
    setExamToEdit(exam);
    setEditingExamName(exam.name);
    setIsEditModalOpen(true);
    setOpenDropdown(null);
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

      {/* Sistema de Pestañas */}
      <div className="neu-card p-6">
        {/* Navegación de Pestañas */}
        <div className="flex space-x-1 mb-8">
          <button
            onClick={() => setActiveTab('exams')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
              activeTab === 'exams'
                ? 'neu-button-active text-gray-700 shadow-inner'
                : 'neu-button text-gray-600 hover:text-gray-700'
            }`}
          >
            Exámenes
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
              activeTab === 'students'
                ? 'neu-button-active text-gray-700 shadow-inner'
                : 'neu-button text-gray-600 hover:text-gray-700'
            }`}
          >
            Alumnos
          </button>
        </div>

        {/* Contenido de la Pestaña Exámenes */}
        {activeTab === 'exams' && (
          <>
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
                  <div key={exam.id} className="neu-card p-4 flex flex-col justify-between relative">
                    {/* Menú de tres puntos */}
                    <div className="absolute top-2 right-2">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === exam.id ? null : exam.id)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
                        title="Opciones"
                      >
                        <div className="flex flex-col space-y-1">
                          <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
                          <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
                          <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
                        </div>
                      </button>
                      
                      {/* Menú desplegable */}
                      {openDropdown === exam.id && (
                        <div className="absolute right-0 top-10 neu-card p-2 min-w-[150px] z-20">
                          <button
                            onClick={() => openEditModal(exam)}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors duration-200"
                          >
                            Editar Nombre
                          </button>
                          <button
                            onClick={() => openDeleteModal(exam)}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>

                    <h3 className="font-semibold text-gray-800 mb-4 pr-8">{exam.name}</h3>
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
          </>
        )}

        {/* Contenido de la Pestaña Alumnos */}
        {activeTab === 'students' && (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-700">Alumnos</h2>
              <div className="flex space-x-4">
                <button className="neu-button text-gray-700 font-semibold py-3 px-6">
                  Importar CSV
                </button>
                <button className="neu-button text-gray-700 font-semibold py-3 px-6">
                  Añadir Alumno
                </button>
              </div>
            </div>

            {/* Tabla de Alumnos */}
            <div className="neu-card p-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">
                        Nombre Completo
                      </th>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">
                        Email Alumno
                      </th>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">
                        Email Tutor
                      </th>
                      <th className="text-left py-4 px-4 font-semibold text-gray-700">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Mensaje cuando no hay alumnos */}
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-gray-600">
                        Aún no hay alumnos en esta clase
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
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

      {/* Modal de confirmación para eliminar examen */}
      {isDeleteModalOpen && examToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="relative neu-card p-8 max-w-lg w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">Confirmar Eliminación</h2>
            <p className="text-gray-600 mb-6 text-center">
              ¿Estás seguro de que deseas eliminar el examen "{examToDelete.name}"?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 neu-button text-gray-700 font-semibold py-3 px-4"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteExam}
                className="flex-1 neu-button bg-red-50 text-red-700 hover:bg-red-100 font-semibold py-3 px-4"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar nombre del examen */}
      {isEditModalOpen && examToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsEditModalOpen(false)} />
          <div className="relative neu-card p-8 max-w-lg w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">Editar Nombre del Examen</h2>
            <form onSubmit={handleEditExamName}>
              <div className="mb-4">
                <label htmlFor="editExamName" className="block text-gray-700 text-sm font-bold mb-2">Nuevo nombre</label>
                <input
                  id="editExamName"
                  type="text"
                  value={editingExamName}
                  onChange={(e) => setEditingExamName(e.target.value)}
                  className="neu-input w-full p-4 text-gray-700 placeholder-gray-500"
                  placeholder="Nuevo nombre del examen"
                  required
                  autoFocus
                />
              </div>
              <div className="flex space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 neu-button text-gray-700 font-semibold py-3 px-4"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 neu-button text-gray-700 font-semibold py-3 px-4"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}