'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useDropzone, FileWithPath } from 'react-dropzone'
import { createClient } from '@/lib/supabaseClient' // Importamos la "fábrica"

// --- Tipos de Datos (CORREGIDOS) ---
interface ExamDetails { id: string; name: string; class_id: string; solution_file_url?: string; }
interface Submission { id: string; student_name: string; submission_file_url: string; status: string; grade?: number; feedback?: string; ai_feedback?: any; student_id?: string; }
interface Student { id: string; full_name: string; student_email: string; tutor_email: string; }
interface Grade { id: string; submission_id: string; }

// --- Componente Principal ---
export default function ExamManagementPage() {
 
  const supabase = createClient(); // <--- CORRECCIÓN 1: Crear instancia
  const params = useParams();
  const examId = params.examId as string;
  const classId = params.classId as string;

  const [examDetails, setExamDetails] = useState<ExamDetails | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingFeedback, setViewingFeedback] = useState<{ feedback: any; grade: Grade | null } | null>(null);

  const fetchData = useCallback(async () => {
    if (!examId) { setLoading(false); return; }
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
  }, [examId, supabase]); // <--- Añadido supabase a las dependencias

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onUploadSuccess = () => fetchData();

  const handleGrade = async (submissionId: string) => {
    setSubmissions(prev => prev.map(sub => sub.id === submissionId ? { ...sub, status: 'processing' } : sub));
    try {
      const { data, error } = await supabase.functions.invoke('grade-submission', { body: { submissionId } });
      if (error) throw error;
      alert('¡Calificación completada!');
      fetchData();
    } catch (error) {
      setSubmissions(prev => prev.map(sub => sub.id === submissionId ? { ...sub, status: 'pending' } : sub));
      alert(`Error: ${(error as Error).message}`);
    }
  };

  const handleViewFeedback = async (submission: Submission) => {
    if (!submission.id) return;
    const { data: grade, error } = await supabase.from('grades').select('id, submission_id').eq('submission_id', submission.id).single();
    if (error) {
      console.error("No se encontró la calificación correspondiente:", error);
    }
    setViewingFeedback({ feedback: submission.ai_feedback, grade: grade || null });
  };

  if (loading) return <div className="p-8 text-center">Cargando...</div>;
  if (!examDetails) return <div className="p-8 text-center">Examen no encontrado.</div>;

  return (
    <div className="neu-container min-h-screen p-8">
      <h1 className="text-4xl font-bold text-gray-700 mb-2">{examDetails.name}</h1>
      <p className="text-lg text-gray-600 mb-8">Gestión del Examen</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <SolutionUploader examDetails={examDetails} onUploadSuccess={onUploadSuccess} />
        <SubmissionsManager submissions={submissions} examId={examId} classId={examDetails.class_id} onUploadSuccess={onUploadSuccess} onGrade={handleGrade} onViewFeedback={handleViewFeedback} />
      </div>
      {viewingFeedback && <FeedbackModal viewingFeedback={viewingFeedback} onClose={() => setViewingFeedback(null)} />}
    </div>
  );
}

// --- Componentes Hijos ---

function SolutionUploader({ examDetails, onUploadSuccess }: { examDetails: ExamDetails; onUploadSuccess: () => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <div className="neu-card p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-700">Material de Referencia</h2>
        {!examDetails.solution_file_url && <button onClick={() => setIsModalOpen(true)} className="neu-button text-gray-700 font-semibold py-3 px-6">Añadir Solucionario</button>}
      </div>
      {!examDetails.solution_file_url ? (
        <div className="text-center text-gray-600 py-8">Aún no hay solucionario para este examen</div>
      ) : (
        <div className="neu-card p-4 flex justify-between items-center shadow-inner">
           <p className="font-semibold text-green-600">✅ Solucionario Subido</p>
           <a href={examDetails.solution_file_url} target="_blank" rel="noopener noreferrer" className="neu-button text-gray-700 py-2 px-4 no-underline">Ver Solucionario</a>
        </div>
      )}
      {isModalOpen && <CreateSolutionModal examId={examDetails.id} onUploadSuccess={onUploadSuccess} onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}

function SubmissionsManager({ submissions, onUploadSuccess, onGrade, onViewFeedback, examId, classId }: { submissions: Submission[]; onUploadSuccess: () => void; onGrade: (id: string) => void; onViewFeedback: (submission: Submission) => void; examId: string; classId: string; }) {
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
                onClick={() => sub.status === 'graded' ? onViewFeedback(sub) : onGrade(sub.id)} 
                disabled={sub.status === 'processing'}
                className="neu-button text-gray-700 py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sub.status === 'processing' ? 'Procesando...' : sub.status === 'graded' ? 'Ver Resultado' : 'Calificar'}
              </button>
            </div>
          ))}
        </div>
      )}
      {isModalOpen && <CreateSubmissionModal onClose={() => setIsModalOpen(false)} examId={examId} onUploadSuccess={onUploadSuccess} classId={classId} />}
    </div>
  );
}

function CreateSubmissionModal({ onClose, examId, onUploadSuccess, classId }: { onClose: () => void; examId: string; onUploadSuccess: () => void; classId: string; }) {
  const supabase = createClient(); // <--- CORRECCIÓN 2: Crear instancia
  const [filesWithStudents, setFilesWithStudents] = useState<{ file: FileWithPath; studentId: string | null }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    const fetchStudents = async () => {
      const { data, error } = await supabase.from('students').select('*').eq('class_id', classId).order('full_name');
      if (error) console.error('Error al cargar estudiantes:', error);
      else setStudents(data || []);
    };
    fetchStudents();
  }, [classId, supabase]); // <--- Añadido supabase a las dependencias

  const onDrop = useCallback((acceptedFiles: FileWithPath[]) => {
    const newFiles = acceptedFiles.map(file => ({ file, studentId: null }));
    setFilesWithStudents(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({ onDrop, multiple: true, accept: { 'application/pdf': ['.pdf'] } });

  const handleStudentSelect = (fileIndex: number, studentId: string) => {
    setFilesWithStudents(prev => prev.map((item, index) => index === fileIndex ? { ...item, studentId } : item));
  };

  const handleUpload = async () => {
    const filesToUpload = filesWithStudents.filter(f => f.studentId);
    if (filesToUpload.length !== filesWithStudents.length) {
      alert('Por favor, asigna un estudiante a cada archivo.');
      return;
    }
    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado.');

      for (const item of filesToUpload) {
        const { file, studentId } = item;
        const selectedStudent = students.find(s => s.id === studentId);
        if (!file || !studentId || !selectedStudent) continue;

        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${user.id}/submissions/${examId}-${Date.now()}-${sanitizedFileName}`;

        const { error: uploadError } = await supabase.storage.from('exam_files').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('exam_files').getPublicUrl(filePath);
        const publicUrl = urlData.publicUrl;

        await supabase.from('submissions').insert({
          exam_id: examId,
          submission_file_url: publicUrl,
          student_id: studentId,
          student_name: selectedStudent.full_name,
          user_id: user.id
        });
      }
      alert('Entregas subidas exitosamente!');
      onClose();
      onUploadSuccess();
    } catch (error) {
      alert(`Error: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
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
        {filesWithStudents.length > 0 && (
          <div className="mb-6 space-y-3">
            <h3 className="font-semibold text-slate-800 mb-3">Archivos seleccionados:</h3>
            {filesWithStudents.map((item, index) => (
              <div key={`${item.file.name}-${index}`} className="flex items-center justify-between p-3 neu-card bg-gray-50">
                <span className="text-sm text-slate-800 flex-1">{item.file.name}</span>
                <select value={item.studentId || ''} onChange={(e) => handleStudentSelect(index, e.target.value)} className="ml-3 neu-input px-3 py-2 text-sm min-w-[200px]">
                  <option value="">Seleccionar estudiante</option>
                  {students.map(student => ( <option key={student.id} value={student.id}>{student.full_name}</option> ))}
                </select>
              </div>
            ))}
          </div>
        )}
        <div className="flex space-x-4">
          <button onClick={onClose} className="flex-1 neu-button py-3 text-slate-700 font-medium">Cancelar</button>
          <button onClick={handleUpload} disabled={isUploading || filesWithStudents.length === 0} className="flex-1 neu-button py-3 disabled:opacity-50 text-slate-700 font-medium">
            {isUploading ? 'Subiendo...' : `Subir ${filesWithStudents.length} Archivos`}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateSolutionModal({ examId, onUploadSuccess, onClose }: { examId: string; onUploadSuccess: () => void; onClose: () => void }) {
  const supabase = createClient(); // <--- CORRECCIÓN 3: Crear instancia
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { getRootProps, getInputProps } = useDropzone({ onDrop: (files) => setFile(files[0] || null), multiple: false });

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado.');

      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${user.id}/solutions/${examId}-${Date.now()}-${sanitizedFileName}`;

      const { error: uploadError } = await supabase.storage.from('exam_files').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('exam_files').getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase.from('exams').update({ solution_file_url: publicUrl }).eq('id', examId);
      if (updateError) throw updateError;

      alert('Solucionario subido con éxito!');
      onUploadSuccess();
    } catch (error) {
      console.error('Error en subida de solucionario:', error);
      alert(`Error: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
      onClose();
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
        {file && (<div className="mb-6"><p className="text-sm text-slate-800">{file.name}</p></div>)}
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

function FeedbackModal({ viewingFeedback, onClose }: { viewingFeedback: { feedback: any; grade: Grade | null }; onClose: () => void }) {
  const supabase = createClient(); // <--- CORRECCIÓN 4: Crear instancia
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleSendEmail = async () => {
    if (!viewingFeedback.grade) {
      alert("No se puede enviar el correo, no se encontró el ID de la calificación.");
      return;
    }
    setIsSendingEmail(true);
    try {
      // Usaremos una API Route en lugar de Edge Function
      const response = await fetch('/api/send-results-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gradeId: viewingFeedback.grade.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      alert(`¡Correo enviado con éxito!`);
    } catch (error) {
      console.error('Error al enviar correo:', error);
      alert(`Error al enviar correo: ${(error as Error).message}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const feedbackData = viewingFeedback.feedback?.informe_evaluacion || viewingFeedback.feedback || {};
  const resumen = feedbackData.resumen_general || {};
  const evaluaciones = feedbackData.evaluacion_detallada || [];
  const metadatos = feedbackData.metadatos || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative neu-card p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">📊 Reporte de Calificación</h2>
          {metadatos.nombre_alumno && (<p className="text-lg text-slate-600">Estudiante: {metadatos.nombre_alumno}</p>)}
        </div>
        {/* ... El resto del JSX del modal de feedback se mantiene igual ... */}
      </div>
    </div>
  );
}