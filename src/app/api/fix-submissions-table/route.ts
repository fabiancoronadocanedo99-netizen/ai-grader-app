import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Corrigiendo tabla submissions...');
    
    // Paso 1: Verificar estructura actual
    const { data: currentData, error: currentError } = await supabase
      .from('submissions')
      .select('*')
      .limit(1);
    
    console.log('📊 Estructura actual de submissions:', currentError?.message || 'tabla accesible');
    
    // Paso 2: Eliminar tabla actual de forma segura
    console.log('🗑️ Eliminando tabla submissions incorrecta...');
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'DROP TABLE IF EXISTS public.submissions;'
    });
    
    if (dropError) {
      console.log('⚠️ Error al eliminar tabla (puede que no exista):', dropError.message);
    }

    // Paso 3: Crear tabla con estructura correcta
    console.log('🏗️ Creando tabla submissions con estructura correcta...');
    const createTableSQL = `
      CREATE TABLE public.submissions (
        id SERIAL PRIMARY KEY,
        exam_id INTEGER NOT NULL,
        submission_file_url TEXT NOT NULL,
        student_id INTEGER NOT NULL,
        student_name VARCHAR(255) NOT NULL,
        user_id UUID NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        grade DECIMAL(5,2),
        ai_feedback TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    const { data: createData, error: createError } = await supabase.rpc('exec_sql', {
      sql: createTableSQL
    });
    
    if (createError) {
      console.error('❌ Error creando tabla:', createError.message);
      return NextResponse.json(
        { 
          success: false, 
          error: createError.message,
          step: 'create_table'
        },
        { status: 500 }
      );
    }

    // Paso 4: Configurar RLS (Row Level Security)
    console.log('🔒 Configurando RLS...');
    const rlsSQL = `
      ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Users can view their own submissions" ON public.submissions
        FOR SELECT USING (auth.uid() = user_id);
        
      CREATE POLICY "Users can insert their own submissions" ON public.submissions
        FOR INSERT WITH CHECK (auth.uid() = user_id);
        
      CREATE POLICY "Users can update their own submissions" ON public.submissions
        FOR UPDATE USING (auth.uid() = user_id);
    `;
    
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: rlsSQL
    });
    
    if (rlsError) {
      console.log('⚠️ Error configurando RLS:', rlsError.message);
    }

    // Paso 5: Verificar que la nueva tabla funciona
    console.log('✅ Verificando nueva tabla...');
    const { data: testData, error: testError } = await supabase
      .from('submissions')
      .select('id, exam_id, submission_file_url, student_id, student_name, user_id, status, grade, ai_feedback')
      .limit(1);
    
    if (testError) {
      console.error('❌ Error verificando nueva tabla:', testError.message);
      return NextResponse.json(
        { 
          success: false, 
          error: testError.message,
          step: 'verify_table'
        },
        { status: 500 }
      );
    }

    console.log('🎉 Tabla submissions recreada exitosamente!');
    
    return NextResponse.json({
      success: true,
      message: 'Tabla submissions recreada con estructura correcta',
      newStructure: {
        columns: [
          'id (SERIAL)',
          'exam_id (INTEGER)', 
          'submission_file_url (TEXT)',
          'student_id (INTEGER)',
          'student_name (VARCHAR)',
          'user_id (UUID)',
          'status (VARCHAR)',
          'grade (DECIMAL)',
          'ai_feedback (TEXT)',
          'created_at (TIMESTAMP)',
          'updated_at (TIMESTAMP)'
        ]
      }
    });

  } catch (error) {
    console.error('❌ Error general:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: (error as Error).message,
        step: 'general_error'
      },
      { status: 500 }
    );
  }
}