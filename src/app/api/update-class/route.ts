import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

// Usar el mismo pool que en las otras APIs
const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

export async function PUT(request: NextRequest) {
  try {
    console.log('✏️ Iniciando actualización de clase...');
    
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

    const body = await request.json();
    const { classId, name, subject, grade_level } = body;
    
    if (!classId?.trim()) {
      return NextResponse.json(
        { error: 'ID de clase requerido' }, 
        { status: 400 }
      );
    }

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Nombre de clase requerido' }, 
        { status: 400 }
      );
    }

    console.log('✅ Usuario autenticado:', user.id);

    // Usar conexión directa a PostgreSQL
    const client = await pool.connect();
    
    try {
      // Verificar que la clase pertenece al usuario antes de actualizar
      const checkResult = await client.query(`
        SELECT id, name FROM classes 
        WHERE id = $1 AND teacher_id = $2
      `, [classId, user.id]);

      if (checkResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Clase no encontrada o no tienes permisos para editarla' }, 
          { status: 404 }
        );
      }

      console.log('✏️ Actualizando clase:', name);

      // Actualizar la clase
      const updateResult = await client.query(`
        UPDATE classes 
        SET name = $1, subject = $2, grade_level = $3, updated_at = NOW()
        WHERE id = $4 AND teacher_id = $5
        RETURNING id, name, subject, grade_level, updated_at
      `, [name.trim(), subject || null, grade_level || null, classId, user.id]);

      if (updateResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'No se pudo actualizar la clase' }, 
          { status: 500 }
        );
      }

      console.log('✅ Clase actualizada exitosamente:', updateResult.rows[0].name);
      return NextResponse.json({
        success: true,
        message: 'Clase actualizada exitosamente',
        class: updateResult.rows[0]
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error fatal actualizando clase:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: (error as Error).message
      }, 
      { status: 500 }
    );
  }
}