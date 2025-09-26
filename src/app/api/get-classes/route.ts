import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

// Usar el mismo pool que en create-class
const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

export async function GET(request: NextRequest) {
  try {
    console.log('📚 Obteniendo clases...');
    
    // Obtener el token de autorización del header
    const authHeader = request.headers.get('authorization');
    const accessToken = authHeader?.replace('Bearer ', '');
    
    if (!accessToken) {
      console.log('❌ No se encontró token de autorización');
      return NextResponse.json(
        { error: 'Token de autenticación requerido' }, 
        { status: 401 }
      );
    }

    // Crear cliente de Supabase solo para verificar el usuario
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );

    // Verificar el token y obtener el usuario
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('❌ Error de autenticación:', userError);
      return NextResponse.json(
        { error: 'Usuario no válido' }, 
        { status: 401 }
      );
    }

    console.log('✅ Usuario autenticado:', user.id);

    // Usar conexión directa a PostgreSQL
    const client = await pool.connect();
    
    try {
      // Obtener todas las clases del usuario
      console.log('📚 Obteniendo clases del usuario...');
      const classResult = await client.query(`
        SELECT id, name, subject, grade_level, created_at, updated_at
        FROM classes 
        WHERE teacher_id = $1 
        ORDER BY created_at DESC
      `, [user.id]);

      const classes = classResult.rows;

      console.log(`✅ Se encontraron ${classes.length} clases`);
      return NextResponse.json({
        success: true,
        classes: classes
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error fatal obteniendo clases:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: (error as Error).message
      }, 
      { status: 500 }
    );
  }
}