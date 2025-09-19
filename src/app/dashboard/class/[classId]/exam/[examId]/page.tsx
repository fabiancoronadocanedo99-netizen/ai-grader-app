'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useDropzone, FileWithPath } from 'react-dropzone'
import { supabase } from '@/lib/supabaseClient'

// --- Tipos de Datos ---
interface ExamDetails { id: number; name: string; class_id: number; solution_file_url?: string; }
interface Submission { id: number; student_name: string; submission_file_url: string; status: string; grade?: number; feedback?: string; ai_feedback?: any; }
interface Student { id: number; full_name: string; student_email: string; tutor_email: string; }

// --- Componente Principal ---
export default function ExamManagementPage() {
  const params = useParams();
  const examId = parseInt(params.examId as string, 10);

  const [examDetails, setExamDetails] = useState<ExamDetails | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingFeedback, setViewingFeedback] = useState<any>(null);

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
      // Actualizar el estado local para mostrar "processing"
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

        if (data.success) {
          alert('¡Calificación completada!');
          fetchData(); // Refrescar toda la lista con el nuevo estado "graded"
        }
      } catch (error) {
        // Revertir el estado a "pending" en caso de error
        setSubmissions(prev => 
          prev.map(sub => 
            sub.id === submissionId 
              ? { ...sub, status: 'pending' } 
              : sub
          )
        );
        alert(`Error: ${(error as Error).message}`);
      }
    };
  // --- Renderizado ---
  if (loading) return <div className="p-8 text-center">Cargando...</div>;
  if (!examDetails) return <div className="p-8 text-center">Examen no encontrado.</div>;

  return (
    <div className="neu-container min-h-screen p-8">
      <h1 className="text-4xl font-bold text-gray-700 mb-2">{examDetails.name}</h1>
      <p className="text-lg text-gray-600 mb-8">Gestión del Examen</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <SolutionUploader examDetails={examDetails} onUploadSuccess={onUploadSuccess} />
        <SubmissionsManager submissions={submissions} examId={examId} onUploadSuccess={onUploadSuccess} onGrade={handleGrade} onViewFeedback={setViewingFeedback} />
      </div>
      {viewingFeedback && (
        <FeedbackModal 
          feedback={viewingFeedback} 
          onClose={() => setViewingFeedback(null)} 
        />
      )}
    </div>
  );
}

// --- Componentes Hijos ---

// Componente para subir el solucionario
function SolutionUploader({ examDetails, onUploadSuccess }: { examDetails: ExamDetails; onUploadSuccess: () => void }) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="neu-card p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-700">Material de Referencia</h2>
                <button onClick={() => setIsModalOpen(true)} className="neu-button text-gray-700 font-semibold py-3 px-6">Añadir Solucionario</button>
            </div>
            {!examDetails.solution_file_url ? (
                <div className="text-center text-gray-600 py-8">Aún no hay solucionario para este examen</div>
            ) : (
                <div className="neu-card p-4 flex justify-between items-center">
                    <p>Archivo actual</p>
                    <a href={examDetails.solution_file_url} target="_blank" rel="noopener noreferrer" className="neu-button text-gray-700 py-2 px-4 no-underline">Ver Solucionario</a>
                </div>
            )}
            {isModalOpen && <CreateSolutionModal examId={examDetails.id} onUploadSuccess={() => { onUploadSuccess(); setIsModalOpen(false); }} onClose={() => setIsModalOpen(false)} />}
        </div>
    );
}

// Componente para gestionar las entregas
function SubmissionsManager({ submissions, examId, onUploadSuccess, onGrade, onViewFeedback }: { submissions: Submission[]; examId: number; onUploadSuccess: () => void; onGrade: (submissionId: number) => Promise<void>; onViewFeedback: (feedback: any) => void }) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="neu-card p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-700">Entregas de Alumnos</h2>
                <button onClick={() => setIsModalOpen(true)} className="neu-button text-gray-700 font-semibold py-3 px-6">Añadir Entregas</button>
            </div>
            {submissions.length === 0 ? (
                <div className="text-center text-gray-600 py-8">Aún no hay entregas para este examen</div>
            ) : (
                <div className="space-y-3">
                    {submissions.map(sub => (
                        <div key={sub.id} className="bg-gray-200/80 rounded-lg p-4 flex justify-between items-center">
                            <p>{sub.student_name}</p>
                            <button 
                                onClick={() => sub.status === 'graded' ? onViewFeedback(sub.ai_feedback) : onGrade(sub.id)} 
                                disabled={sub.status === 'processing'}
                                className="neu-button text-gray-700 py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {sub.status === 'processing' ? 'Procesando...' : sub.status === 'graded' ? 'Ver Resultado' : 'Calificar'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
            {isModalOpen && (
                <CreateSubmissionModal 
                    onClose={() => setIsModalOpen(false)}
                    examId={examId} 
                    onUploadSuccess={onUploadSuccess} 
                />
            )}
        </div>
    );
}

// Componente Modal para subir entregas
function CreateSubmissionModal({ onClose, examId, onUploadSuccess, classId }: {
    onClose: () => void;
    examId: number;
    onUploadSuccess: () => void;
    classId: number;
}) {
    const [files, setFiles] = useState<FileWithPath[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [students, setStudents] = useState<Student[]>([]);
    const [fileStudentMap, setFileStudentMap] = useState<Record<string, number>>({});

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
                const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                const filePath = `${user.id}/submissions/${examId}-${Date.now()}-${sanitizedFileName}`;
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative neu-card p-8 max-w-2xl w-full mx-4">
                <h2 className="text-center font-bold text-2xl mb-6 text-slate-800">Subir Entregas</h2>
                <div {...getRootProps()} className="mb-6 neu-input p-6 border-2 border-dashed border-gray-400/50 cursor-pointer text-center">
                    <input {...getInputProps()} />
                    <p className="text-slate-700">Arrastra los archivos aquí, o haz clic para seleccionarlos.</p>
                </div>
                {files.length > 0 && (
                    <div className="mb-6 space-y-2">
                        {files.map((file, i) => <p key={i} className="text-sm text-slate-800">{file.name}</p>)}
                    </div>
                )}
                <div className="flex space-x-4">
                    <button onClick={onClose} className="flex-1 neu-button py-3 text-slate-700 font-medium">Cancelar</button>
                    <button onClick={handleUpload} disabled={isUploading || files.length === 0} className="flex-1 neu-button py-3 disabled:opacity-50 text-slate-700 font-medium">
                        {isUploading ? 'Subiendo...' : `Subir ${files.length} Archivos`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Modal para subir solucionario
function CreateSolutionModal({ examId, onUploadSuccess, onClose }: { examId: number; onUploadSuccess: () => void; onClose: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        setFile(acceptedFiles[0] || null);
    }, []);

    const { getRootProps, getInputProps } = useDropzone({ onDrop, multiple: false });

    const handleUpload = async () => {
        console.log('Iniciando subida de solucionario...');
        if (!file) return;
        setIsUploading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuario no autenticado.');
            console.log('Obtenido usuario:', user.id);

            const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const filePath = `${user.id}/solutions/${examId}-${Date.now()}-${sanitizedFileName}`;
            const { data, error } = await supabase.storage.from('exam_files').upload(filePath, file);
            if (error) throw error;
            console.log('Archivo subido a Storage:', data.path);

            const { data: { publicUrl } } = supabase.storage.from('exam_files').getPublicUrl(data.path);
            console.log('URL pública obtenida:', publicUrl);
            
            const { error: updateError } = await supabase.from('exams').update({ solution_file_url: publicUrl }).eq('id', examId);
            if (updateError) throw updateError;
            console.log('Registro actualizado en DB para examen:', examId);

            alert('Solucionario subido con éxito!');
            console.log('Subida completada, llamando a refresco...');
        } catch (error) {
            console.error('Error en subida de solucionario:', error);
            alert(`Error: ${(error as Error).message}`);
        } finally {
            setIsUploading(false);
            setFile(null);
            onClose();
            onUploadSuccess();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative neu-card p-8 max-w-2xl w-full mx-4">
                <h2 className="text-center font-bold text-2xl mb-6 text-slate-800">Subir Solucionario</h2>
                <div {...getRootProps()} className="mb-6 neu-input p-6 border-2 border-dashed border-gray-400/50 cursor-pointer text-center">
                    <input {...getInputProps()} />
                    <p className="text-slate-700">Arrastra el solucionario aquí, o haz clic para seleccionarlo.</p>
                </div>
                {file && (
                    <div className="mb-6">
                        <p className="text-sm text-slate-800">{file.name}</p>
                    </div>
                )}
                <div className="flex space-x-4">
                    <button onClick={onClose} className="flex-1 neu-button py-3 text-slate-700 font-medium">Cancelar</button>
                    <button onClick={handleUpload} disabled={isUploading || !file} className="flex-1 neu-button py-3 disabled:opacity-50 text-slate-700 font-medium">
                        {isUploading ? 'Subiendo...' : 'Subir Solucionario'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Componente Modal para mostrar el feedback de IA
function FeedbackModal({ feedback, onClose }: { feedback: any; onClose: () => void }) {
  // Parsear el feedback si es un string JSON (común en DBs)
  let parsedFeedback = feedback;
  if (typeof feedback === 'string') {
    try {
      parsedFeedback = JSON.parse(feedback);
    } catch (e) {
      console.warn('No se pudo parsear el feedback JSON:', e);
      parsedFeedback = {};
    }
  }
  
  const feedbackData = parsedFeedback?.informe_evaluacion || parsedFeedback;
  const resumen = feedbackData?.resumen_general || {};
  const evaluaciones = feedbackData?.evaluacion_detallada || [];
  const metadatos = feedbackData?.metadatos || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative neu-card p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">📊 Reporte de Calificación</h2>
          {metadatos.nombre_alumno && (
            <p className="text-lg text-slate-600">Estudiante: {metadatos.nombre_alumno}</p>
          )}
        </div>

        {/* Resumen General */}
        <div className="neu-card p-6 mb-6">
          <h3 className="text-xl font-bold text-slate-700 mb-4">📈 Resumen General</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="neu-card p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {resumen.puntuacion_total_obtenida || 0}/{resumen.puntuacion_total_posible || 100}
                </div>
                <p className="text-slate-600">Puntuación Total</p>
              </div>
            </div>
            <div className="neu-card p-4">
              <div className="flex justify-around text-center">
                <div>
                  <div className="text-lg font-bold text-green-600">✅ {resumen.preguntas_correctas || 0}</div>
                  <p className="text-xs text-slate-600">Correctas</p>
                </div>
                <div>
                  <div className="text-lg font-bold text-yellow-600">⚠️ {resumen.preguntas_parciales || 0}</div>
                  <p className="text-xs text-slate-600">Parciales</p>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-600">❌ {resumen.preguntas_incorrectas || 0}</div>
                  <p className="text-xs text-slate-600">Incorrectas</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Evaluación Detallada */}
        <div className="space-y-4 mb-6">
          <h3 className="text-xl font-bold text-slate-700">📝 Evaluación Detallada</h3>
          {evaluaciones.map((pregunta: any, index: number) => (
            <div key={index} className="neu-card p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-slate-800">
                    {pregunta.evaluacion === 'CORRECTO' && '✅'}
                    {pregunta.evaluacion === 'PARCIALMENTE_CORRECTO' && '⚠️'}
                    {pregunta.evaluacion === 'INCORRECTO' && '❌'}
                    {' '}{pregunta.pregunta_id || `Pregunta ${index + 1}`}
                  </h4>
                  <p className="text-sm text-slate-600">{pregunta.tema}</p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-700">
                    {pregunta.puntuacion_obtenida}/{pregunta.puntuacion_posible}
                  </div>
                  <div className="text-xs text-slate-500">
                    {pregunta.evaluacion}
                  </div>
                </div>
              </div>
              
              {pregunta.feedback && (
                <div className="space-y-2">
                  {pregunta.feedback.refuerzo_positivo && (
                    <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded">
                      <p className="text-green-700 text-sm">💚 {pregunta.feedback.refuerzo_positivo}</p>
                    </div>
                  )}
                  {pregunta.feedback.area_de_mejora && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                      <p className="text-yellow-700 text-sm">💡 <strong>Área de mejora:</strong> {pregunta.feedback.area_de_mejora}</p>
                    </div>
                  )}
                  {pregunta.feedback.explicacion_del_error && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded">
                      <p className="text-red-700 text-sm">🔍 <strong>Explicación:</strong> {pregunta.feedback.explicacion_del_error}</p>
                    </div>
                  )}
                  {pregunta.feedback.sugerencia_de_estudio && (
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                      <p className="text-blue-700 text-sm">📚 <strong>Sugerencia:</strong> {pregunta.feedback.sugerencia_de_estudio}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Botón Cerrar */}
        <div className="text-center">
          <button 
            onClick={onClose}
            className="neu-button text-slate-700 font-semibold py-3 px-8"
          >
            Cerrar Reporte
          </button>
        </div>
      </div>
    </div>
  );
}