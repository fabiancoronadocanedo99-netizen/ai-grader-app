'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useDropzone, FileWithPath } from 'react-dropzone'
import { supabase } from '../../../../../../lib/supabaseClient'

// --- Interfaces de Tipos ---
interface ExamDetails {
  id: number;
  name: string;
  class_id: number;
  solution_file_url?: string;
  created_at?: string;
}

interface Submission {
  id: number;
  exam_id: number;
  student_name: string;
  submission_file_url: string;
  status: string;
  created_at?: string;
}

// --- Componente Principal ---
export default function ExamManagementPage() {
  const params = useParams();
  const examId = parseInt(params.examId as string, 10);
  
  const [examDetails, setExamDetails] = useState<ExamDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [solutionFile, setSolutionFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionFiles, setSubmissionFiles] = useState<FileWithPath[]>([]);
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);

  // --- Funciones de Carga de Datos ---
  const fetchExamDetails = useCallback(async () => {
    if (isNaN(examId)) return;
    const { data, error } = await supabase.from('exams').select('*').eq('id', examId).single();
    if (error) {
      console.error('Error al cargar detalles del examen:', error);
      setExamDetails(null);
    } else {
      setExamDetails(data);
    }
  }, [examId]);

  const fetchSubmissions = useCallback(async () => {
    if (isNaN(examId)) return;
    const { data, error } = await supabase.from('submissions').select('*').eq('exam_id', examId).order('created_at', { ascending: false });
    if (error) {
      console.error('Error al cargar las entregas:', error);
      setSubmissions([]);
    } else {
      setSubmissions(data || []);
    }
  }, [examId]);

  useEffect(() => {
    const loadData = async () => {
      if (isNaN(examId)) { setLoading(false); return; }
      // Limpiar estados anteriores al principio
      setExamDetails(null);
      setSubmissions([]);
      setLoading(true);
      await Promise.all([fetchExamDetails(), fetchSubmissions()]);
      setLoading(false);
    };
    loadData();
  }, [examId, fetchExamDetails, fetchSubmissions]);

  // --- Funciones de Subida y Calificación ---
  const handleUploadSolution = async () => {
    if (!solutionFile || isNaN(examId)) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado.');
      const filePath = `${user.id}/solutions/${examId}-${Date.now()}-${solutionFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from('exam_files').upload(filePath, solutionFile);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('exam_files').getPublicUrl(uploadData.path);
      const { error: updateError } = await supabase.from('exams').update({ solution_file_url: publicUrl }).eq('id', examId);
      if (updateError) throw updateError;
      alert('Solucionario subido exitosamente');
      await fetchExamDetails();
      setSolutionFile(null);
    } catch (error) {
      alert(`Error: ${(error as Error).message}`);
    } finally {
      setUploading(false);
    }
  };
  
  const handleUploadSubmissions = async () => {
    if (submissionFiles.length === 0 || isNaN(examId)) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado.');
      for (const file of submissionFiles) {
        const filePath = `${user.id}/submissions/${examId}-${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('exam_files').upload(filePath, file);
        if (uploadError) { console.error(`Error al subir ${file.name}:`, uploadError); continue; }
        const { data: { publicUrl } } = supabase.storage.from('exam_files').getPublicUrl(uploadData.path);
        const newSubmission = { 
          exam_id: examId,
          submission_file_url: publicUrl, 
          student_name: file.name.split('.').slice(0, -1).join('.'),
          user_id: user.id
        };
        const { error: insertError } = await supabase.from('submissions').insert([newSubmission]);
        if (insertError) console.error(`Error al crear registro para ${file.name}:`, insertError);
      }
      alert('Entregas subidas exitosamente');
    } catch (error) {
      alert(`Error: ${(error as Error).message}`);
    } finally {
      setIsSubmissionModalOpen(false);
      setSubmissionFiles([]);
      // Recargar la lista de entregas como última acción
      await fetchSubmissions();
      setUploading(false);
    }
  };

  // --- Renderizado del Componente ---
  if (loading) {
    return <div className="p-8 text-center text-gray-600">Cargando...</div>;
  }

  if (!examDetails) {
    return <div className="p-8 text-center text-gray-600">No se pudo cargar la información del examen.</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-700 mb-2">{examDetails.name}</h1>
        <p className="text-lg text-gray-600">Gestión del Examen</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sección Izquierda - Material de Referencia */}
        <div className="bg-gray-200/60 backdrop-blur-sm rounded-xl p-6 shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff]">
          <h2 className="text-2xl font-bold text-gray-700 mb-6">Material de Referencia</h2>
          <div className="space-y-4">
            {!examDetails.solution_file_url ? (
              <>
                <SolutionDropzone onFileAccepted={setSolutionFile} />
                {solutionFile && (
                  <div className="bg-gray-200/80 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-2">Archivo seleccionado:</p>
                    <p className="text-gray-700 font-medium">{solutionFile.name}</p>
                    <button
                      onClick={handleUploadSolution}
                      disabled={uploading}
                      className="w-full mt-4 bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff] active:shadow-inner-[2px_2px_4px_#d1d9e6,-2px_-2px_4px_#ffffff] transition-all duration-200 disabled:opacity-50"
                    >
                      {uploading ? 'Subiendo...' : 'Guardar Solucionario'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-gray-200/80 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Archivo actual:</p>
                <a href={examDetails.solution_file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                  Ver solucionario
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Sección Derecha - Entregas de Alumnos */}
        <div className="bg-gray-200/60 backdrop-blur-sm rounded-xl p-6 shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-700">Entregas de Alumnos</h2>
            <button 
              onClick={() => setIsSubmissionModalOpen(true)}
              className="bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl shadow-[6px_6px_12px_#d1d9e6,-6px_-6px_12px_#ffffff] active:shadow-inner-[2px_2px_4px_#d1d9e6,-2px_-2px_4px_#ffffff] transition-all"
            >
              Añadir Entregas
            </button>
          </div>
          
          {submissions.length === 0 ? (
            <div className="text-center text-gray-600 py-8">Aún no hay entregas para este examen</div>
          ) : (
            <div className="space-y-3">
              {submissions.map((submission) => (
                <div key={submission.id} className="bg-gray-200/80 rounded-lg p-4 shadow-[3px_3px_6px_#d1d9e6,-3px_-3px_6px_#ffffff]">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-gray-700">{submission.student_name}</h4>
                      <a href={submission.submission_file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm underline">
                        Ver entrega
                      </a>
                    </div>
                    <button className="bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg shadow-[3px_3px_6px_#d1d9e6,-3px_-3px_6px_#ffffff] active:shadow-inner-[1px_1px_3px_#d1d9e6,-1px_-1px_3px_#ffffff]">
                      Calificar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isSubmissionModalOpen && (
        <SubmissionModal
          isOpen={isSubmissionModalOpen}
          onClose={() => setIsSubmissionModalOpen(false)}
          onUpload={handleUploadSubmissions}
          files={submissionFiles}
          setFiles={setSubmissionFiles}
          isUploading={uploading}
        />
      )}
    </div>
  );
}

// --- Componentes Auxiliares Refactorizados ---

function SolutionDropzone({ onFileAccepted }: { onFileAccepted: (file: File | null) => void }) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFileAccepted(acceptedFiles[0] || null);
  }, [onFileAccepted]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false, accept: {'application/pdf': ['.pdf']} });

  return (
    <div {...getRootProps()} className={`bg-gray-200/80 rounded-lg p-6 border-2 border-dashed transition-colors cursor-pointer ${isDragActive ? 'border-blue-400 bg-blue-50/50' : 'border-gray-400/50 hover:border-gray-500/70'}`}>
      <input {...getInputProps()} />
      <p className="text-center text-gray-600">Arrastra y suelta el solucionario aquí, o haz clic para seleccionarlo.</p>
    </div>
  );
}

function SubmissionModal({ isOpen, onClose, onUpload, files, setFiles, isUploading }: {
  isOpen: boolean;
  onClose: () => void;
  onUpload: () => void;
  files: FileWithPath[];
  setFiles: (files: FileWithPath[]) => void;
  isUploading: boolean;
}) {
  if (!isOpen) return null;

  const onDrop = useCallback((acceptedFiles: FileWithPath[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, [setFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true, accept: {'application/pdf': ['.pdf']} });

  const removeFile = (fileToRemove: FileWithPath) => {
    setFiles(files.filter(file => file !== fileToRemove));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-gray-200/60 backdrop-blur-md rounded-xl p-8 shadow-lg max-w-2xl w-full mx-4">
        <h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">Subir Entregas de Alumnos</h2>
        <div {...getRootProps()} className={`mb-6 bg-gray-200/80 rounded-lg p-6 border-2 border-dashed transition-colors cursor-pointer ${isDragActive ? 'border-blue-400 bg-blue-50/50' : 'border-gray-400/50 hover:border-gray-500/70'}`}>
          <input {...getInputProps()} />
          <p className="text-center text-gray-600">Arrastra y suelta los archivos aquí, o haz clic para seleccionarlos.</p>
        </div>
        {files.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">Archivos seleccionados ({files.length}):</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-gray-200/50 rounded-lg">
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="bg-gray-200/80 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-gray-700 text-sm truncate">{file.name}</span>
                  <button onClick={() => removeFile(file)} className="text-red-500 hover:text-red-700 ml-4">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex space-x-4">
          <button onClick={onClose} className="flex-1 bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff] active:shadow-inner-[2px_2px_4px_#d1d9e6,-2px_-2px_4px_#ffffff]">
            Cancelar
          </button>
          <button onClick={onUpload} disabled={files.length === 0 || isUploading} className="flex-1 bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff] active:shadow-inner-[2px_2px_4px_#d1d9e6,-2px_-2px_4px_#ffffff] disabled:opacity-50">
            {isUploading ? 'Subiendo...' : `Subir ${files.length} Entregas`}
          </button>
        </div>
      </div>
    </div>
  );
}