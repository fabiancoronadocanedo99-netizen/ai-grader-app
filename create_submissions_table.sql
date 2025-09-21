-- Script para crear la tabla submissions en Supabase
-- Ejecuta este SQL en: Dashboard de Supabase > SQL Editor

CREATE TABLE IF NOT EXISTS public.submissions (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL,
    submission_file_url TEXT NOT NULL,
    student_id INTEGER NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    grade DECIMAL(5,2),
    ai_feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    CONSTRAINT fk_submissions_exam FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE,
    CONSTRAINT fk_submissions_student FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE
);

-- Verificar que la tabla se creó correctamente
SELECT 'submissions' as tabla_creada, COUNT(*) as registros FROM public.submissions;