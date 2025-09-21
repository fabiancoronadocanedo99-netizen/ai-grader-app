import { supabase } from './supabaseClient';

export async function initializeSubmissionsTable(): Promise<boolean> {
  try {
    // SQL para crear la tabla submissions si no existe
    const createTableSQL = `
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
    `;

    // Ejecutar el SQL usando el cliente de Supabase
    const { error } = await supabase.rpc('exec_sql', { 
      sql_query: createTableSQL 
    });

    if (error) {
      console.error('Error creando tabla submissions:', error);
      return false;
    }

    console.log('✅ Tabla submissions creada exitosamente');
    return true;

  } catch (error) {
    console.error('Error al inicializar tabla submissions:', error);
    return false;
  }
}

// Función alternativa usando una consulta directa
export async function createSubmissionsTableDirect(): Promise<boolean> {
  try {
    // Intentar hacer una consulta simple para verificar si la tabla existe
    const { error: checkError } = await supabase
      .from('submissions')
      .select('id')
      .limit(1);

    if (!checkError) {
      console.log('✅ Tabla submissions ya existe');
      return true;
    }

    // Si hay error, probablemente la tabla no existe
    // Usar SQL directo a través del cliente
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
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
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `
    });

    if (error) {
      console.error('Error con RPC exec_sql:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error en createSubmissionsTableDirect:', error);
    return false;
  }
}