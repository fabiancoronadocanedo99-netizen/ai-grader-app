import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Inicializando base de datos...');

    // SQL para crear la tabla submissions
    const createSubmissionsTableSQL = `
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
    `;

    console.log('📝 Ejecutando SQL para crear tabla submissions...');

    // Intentar verificar si la tabla ya existe
    const { error: checkError } = await supabase
      .from('submissions')
      .select('id')
      .limit(1);

    if (!checkError) {
      console.log('✅ Tabla submissions ya existe');
      return NextResponse.json({
        success: true,
        message: 'Tabla submissions ya existe',
        alreadyExists: true
      });
    }

    console.log('🔍 Tabla no existe, el error es esperado:', checkError.message);

    // Como no podemos ejecutar DDL directamente, devolvemos las instrucciones SQL
    return NextResponse.json({
      success: false,
      error: 'La tabla submissions no existe',
      sqlToExecute: createSubmissionsTableSQL,
      instructions: 'Ve a tu Dashboard de Supabase > SQL Editor y ejecuta el SQL proporcionado',
      details: 'Supabase no permite ejecutar DDL desde el cliente. Debes ejecutar el SQL manualmente.'
    });

    console.log('✅ Tabla submissions creada exitosamente');
    console.log('📊 Resultado:', data);

    return NextResponse.json({
      success: true,
      message: 'Tabla submissions inicializada correctamente',
      data: data
    });

  } catch (error) {
    console.error('❌ Error general inicializando base de datos:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: (error as Error).message,
        details: 'Error general en la inicialización'
      },
      { status: 500 }
    );
  }
}