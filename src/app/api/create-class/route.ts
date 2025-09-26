import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

// Crear pool de conexiones PostgreSQL usando variables de entorno
const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

export async function POST(request: NextRequest) {
  try {
    console.log('🏫 Iniciando creación de clase...');
    
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
    const { className } = body;
    
    if (!className?.trim()) {
      return NextResponse.json(
        { error: 'Nombre de clase requerido' }, 
        { status: 400 }
      );
    }

    console.log('✅ Usuario autenticado:', user.id);

    // Usar conexión directa a PostgreSQL para evitar problemas de cache
    const client = await pool.connect();
    
    try {
      // Paso 1: Asegurar que existe el perfil del usuario
      console.log('📝 Verificando/creando perfil de usuario...');
      await client.query(`
        INSERT INTO profiles (id, full_name, profile_completed, created_at, updated_at)
        VALUES ($1, $2, false, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [user.id, user.email || 'Usuario']);

      // Paso 2: Crear la clase directamente
      console.log('🏫 Creando clase...');
      const classResult = await client.query(`
        INSERT INTO classes (id, name, teacher_id, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
        RETURNING id, name, teacher_id, created_at
      `, [className.trim(), user.id]);

      const newClass = classResult.rows[0];

      console.log('✅ Clase creada exitosamente:', newClass);
      return NextResponse.json({
        success: true,
        message: 'Clase creada exitosamente',
        class: newClass
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error fatal creando clase:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: (error as Error).message
      }, 
      { status: 500 }
    );
  }
}