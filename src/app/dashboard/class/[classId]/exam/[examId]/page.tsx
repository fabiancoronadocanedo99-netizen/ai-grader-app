'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useDropzone, FileWithPath } from 'react-dropzone'
import { supabase } from '@/lib/supabaseClient'

// --- Tipos de Datos ---
interface ExamDetails { id: number; name: string; class_id: number; solution_file_url?: string; }
interface Submission { id: number; student_name: string; submission_file_url: string; status: string; }

// --- Componente Principal ---
export default function ExamManagementPage() {
  const params = useParams();
  const examId = parseInt(params.examId as string, 10);

  const [examDetails, setExamDetails] = useState<ExamDetails | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

      // --- Funciones para Cargar Datos (Versión Corregida) ---
      const fetchData = useCallback(async () => {
        if (isNaN(examId)) {
          setLoading(false);
          return;
        }
        // Limpiamos los estados para evitar "datos fantasma"
        setExamDetails(null);
        setSubmissions([]);
        setLoading(true);

        try {
          const examPromise = supabase.from('exams').select('*').eq('id', examId).single();
          const submissionsPromise = supabase.from('submissions').select('*').eq('exam_id', examId).order('created_at', { ascending: false });

          const [examResult, submissionsResult] = await Promise.all([examPromise, submissionsPromise]);

          if (examResult.error) throw examResult.error;
          setExamDetails(examResult.data);

          if (submissionsResult.error) throw submissionsResult.error;
          setSubmissions(submissionsResult.data || []);
        } catch (error) {
          console.error("Error al cargar los datos de la página:", error);
        } finally {
          setLoading(false);
        }
      }, [examId]);

      useEffect(() => {
        fetchData();
      }, [fetchData]);

    const onUploadSuccess = () => {
      console.log("Upload exitoso, refrescando datos...");
      fetchData(); // Llama a la función principal para recargar todo
    };

    const handleGrade = async (submissionId: number) => {
      // Actualizar estado local para mostrar "processing"
      setSubmissions(prev => 
        prev.map(sub => 
          sub.id === submissionId 
            ? { ...sub, status: 'processing' }
            : sub
        )
      );

      try {
        // Llamar a la Edge Function de Supabase
        const { data, error } = await supabase.functions.invoke('grade-submission', {
          body: { submissionId }
        });

        if (error) throw error;

        // Mostrar alerta de éxito
        alert('Calificación completada');
        
        // Refrescar los datos
        await fetchData();
      } catch (error) {
        // Mostrar error y revertir estado
        alert(`Error: ${(error as Error).message}`);
        
        // Revertir estado a "pending"
        setSubmissions(prev => 
          prev.map(sub => 
            sub.id === submissionId 
              ? { ...sub, status: 'pending' }
              : sub
          )
        );
      }
    };
  // --- Renderizado ---
  if (loading) return <div className="p-8 text-center">Cargando...</div>;
  if (!examDetails) return <div className="p-8 text-center">Examen no encontrado.</div>;

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-gray-700 mb-2">{examDetails.name}</h1>
      <p className="text-lg text-gray-600 mb-8">Gestión del Examen</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <SolutionUploader examDetails={examDetails} onUploadSuccess={onUploadSuccess} />
        <SubmissionsManager submissions={submissions} examId={examId} onUploadSuccess={onUploadSuccess} onGrade={handleGrade} />
      </div>

      <CreateSubmissionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        examId={examId}
        onUploadSuccess={onUploadSuccess}
      />
    </div>
  );
}

// --- Componentes Hijos ---

// Componente para subir el solucionario
function SolutionUploader({ examDetails, onUploadSuccess }: { examDetails: ExamDetails; onUploadSuccess: () => void }) {
    const [solutionFile, setSolutionFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        setSolutionFile(acceptedFiles[0] || null);
    }, []);

    const { getRootProps, getInputProps } = useDropzone({ onDrop, multiple: false });

    const handleUpload = async () => {
        if (!solutionFile) return;
        setUploading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuario no autenticado.');

            const filePath = `${user.id}/solutions/${examDetails.id}-${Date.now()}-${solutionFile.name}`;
            const { data, error } = await supabase.storage.from('exam_files').upload(filePath, solutionFile);
            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage.from('exam_files').getPublicUrl(data.path);
            const { error: updateError } = await supabase.from('exams').update({ solution_file_url: publicUrl }).eq('id', examDetails.id);
            if (updateError) throw updateError;

            alert('Solucionario subido con éxito!');
            onUploadSuccess(); // Llama a la función de refresco del padre
        } catch (error) {
            alert(`Error: ${(error as Error).message}`);
        } finally {
            setUploading(false);
            setSolutionFile(null);
        }
    };

    return (
        <div className="bg-gray-200/60 backdrop-blur-sm rounded-xl p-6 shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff]">
            <h2 className="text-2xl font-bold text-gray-700 mb-6">Material de Referencia</h2>
            {examDetails.solution_file_url ? (
                <div>
                    <p className="text-sm text-gray-600 mb-2">Archivo actual:</p>
                    <a href={examDetails.solution_file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Ver solucionario</a>
                </div>
            ) : (
                <div className="space-y-4">
                    <div {...getRootProps()} className="bg-gray-200/80 rounded-lg p-6 border-2 border-dashed border-gray-400/50 cursor-pointer text-center">
                        <input {...getInputProps()} />
                        <p>Arrastra el solucionario aquí, o haz clic para seleccionarlo.</p>
                    </div>
                    {solutionFile && (
                        <div>
                            <p>{solutionFile.name}</p>
                            <button onClick={handleUpload} disabled={uploading} className="w-full mt-4 bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff] disabled:opacity-50">
                                {uploading ? 'Subiendo...' : 'Guardar Solucionario'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Componente para gestionar las entregas
function SubmissionsManager({ submissions, examId, onUploadSuccess, onGrade }: { submissions: Submission[]; examId: number; onUploadSuccess: () => void; onGrade: (submissionId: number) => Promise<void> }) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="bg-gray-200/60 backdrop-blur-sm rounded-xl p-6 shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff]">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-700">Entregas de Alumnos</h2>
                <button onClick={() => setIsModalOpen(true)} className="bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl shadow-[6px_6px_12px_#d1d9e-6,-6px_-6px_12px_#ffffff]">Añadir Entregas</button>
            </div>
            {submissions.length === 0 ? (
                <div className="text-center text-gray-600 py-8">Aún no hay entregas para este examen</div>
            ) : (
                <div className="space-y-3">
                    {submissions.map(sub => (
                        <div key={sub.id} className="bg-gray-200/80 rounded-lg p-4 flex justify-between items-center">
                            <p>{sub.student_name}</p>
                            <button onClick={() => onGrade(sub.id)} className="bg-gray-200 text-gray-700 py-2 px-4 rounded-lg shadow-[3px_3px_6px_#d1d9e6,-3px_-3px_6px_#ffffff]">
                              {sub.status === 'processing' ? 'Procesando...' : 'Calificar'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
            {isModalOpen && (
                <CreateSubmissionModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} // <-- LA CORRECCIÓN CLAVE
                    examId={examId} 
                    onUploadSuccess={onUploadSuccess} 
                />
            )}
        </div>
    );
}

// Componente Modal para subir entregas
function CreateSubmissionModal({ isOpen, onClose, examId, onUploadSuccess }: {
    isOpen: boolean;
    onClose: () => void;
    examId: number;
    onUploadSuccess: () => void;
}) {
    const [files, setFiles] = useState<FileWithPath[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const onDrop = useCallback((acceptedFiles: FileWithPath[]) => {
        setFiles(prev => [...prev, ...acceptedFiles]);
    }, []);

    const { getRootProps, getInputProps } = useDropzone({ onDrop, multiple: true });

    const handleUpload = async () => {
        console.log('Iniciando subida de entregas...');
        if (files.length === 0) return;
        setIsUploading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuario no autenticado.');
            console.log('Obtenido usuario:', user.id);

            for (const file of files) {
                const filePath = `${user.id}/submissions/${examId}-${Date.now()}-${file.name}`;
                const { data, error } = await supabase.storage.from('exam_files').upload(filePath, file);
                if (error) throw error;
                console.log('Archivo subido a Storage:', data.path);

                const { data: { publicUrl } } = supabase.storage.from('exam_files').getPublicUrl(data.path);
                console.log('URL pública obtenida:', publicUrl);
                const newSubmission = { 
                    exam_id: examId,
                    submission_file_url: publicUrl, 
                    student_name: file.name.split('.').slice(0, -1).join('.'),
                    user_id: user.id
                };
                const { error: insertError } = await supabase.from('submissions').insert([newSubmission]).select();
                if (insertError) throw insertError;
                console.log('Registro insertado en DB para:', file.name);
            }
            alert('Entregas subidas exitosamente!');
            console.log('Subida completada, llamando a refresco...');
        } catch (error) {
            alert(`Error: ${(error as Error).message}`);
        } finally {
            setIsUploading(false);
            setFiles([]);
            onClose();
            onUploadSuccess();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-gray-200/60 backdrop-blur-md rounded-xl p-8 shadow-lg max-w-2xl w-full mx-4">
                <h2 className="text-center font-bold text-2xl mb-6">Subir Entregas</h2>
                <div {...getRootProps()} className="mb-6 bg-gray-200/80 rounded-lg p-6 border-2 border-dashed border-gray-400/50 cursor-pointer text-center">
                    <input {...getInputProps()} />
                    <p>Arrastra los archivos aquí, o haz clic para seleccionarlos.</p>
                </div>
                {files.length > 0 && (
                    <div className="mb-6 space-y-2">
                        {files.map((file, i) => <p key={i} className="text-sm">{file.name}</p>)}
                    </div>
                )}
                <div className="flex space-x-4">
                    <button onClick={onClose} className="flex-1 bg-gray-200 py-3 rounded-lg shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff]">Cancelar</button>
                    <button onClick={handleUpload} disabled={isUploading || files.length === 0} className="flex-1 bg-gray-200 py-3 rounded-lg shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff] disabled:opacity-50">
                        {isUploading ? 'Subiendo...' : `Subir ${files.length} Archivos`}
                    </button>
                </div>
            </div>
        </div>
    );
}