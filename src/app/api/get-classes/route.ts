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
    console.log('📚 Obteniendo clases de TODAS las fuentes...');
    
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

    // Crear cliente de Supabase
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

    let allClasses: any[] = [];

    // 1. OBTENER CLASES DE POSTGRESQL
    const client = await pool.connect();
    try {
      console.log('🔍 Buscando clases en PostgreSQL...');
      const pgResult = await client.query(`
        SELECT id, name, subject, grade_level, created_at, updated_at, 'postgresql' as source
        FROM classes 
        WHERE teacher_id = $1 
        ORDER BY created_at DESC
      `, [user.id]);

      const pgClasses = pgResult.rows;
      console.log(`✅ PostgreSQL: ${pgClasses.length} clases encontradas`);
      allClasses = [...pgClasses];

    } finally {
      client.release();
    }

    // 2. OBTENER CLASES DE SUPABASE
    try {
      console.log('🔍 Buscando clases en Supabase...');
      
      // Intentar obtener clases de Supabase
      const { data: supabaseClasses, error: supabaseError } = await supabase
        .from('classes')
        .select('id, name, subject, grade_level, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (supabaseError) {
        console.warn('⚠️ Error en Supabase (seguiremos solo con PostgreSQL):', supabaseError.message);
      } else if (supabaseClasses && supabaseClasses.length > 0) {
        // Agregar marcador de fuente y filtrar duplicados por nombre
        const supabaseClassesWithSource = supabaseClasses.map(cls => ({
          ...cls,
          source: 'supabase'
        }));

        // Filtrar duplicados (misma clase en ambas bases de datos)
        const existingNames = new Set(allClasses.map(cls => cls.name?.toLowerCase()));
        const newSupabaseClasses = supabaseClassesWithSource.filter(
          cls => !existingNames.has(cls.name?.toLowerCase())
        );

        console.log(`✅ Supabase: ${supabaseClasses.length} clases encontradas, ${newSupabaseClasses.length} nuevas`);
        allClasses = [...allClasses, ...newSupabaseClasses];
      } else {
        console.log('ℹ️ Supabase: 0 clases encontradas');
      }
    } catch (supabaseError) {
      console.warn('⚠️ Error conectando con Supabase:', supabaseError);
      // Continuamos solo con PostgreSQL
    }

    // 3. ORDENAR TODO POR FECHA
    allClasses.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    console.log(`🎯 TOTAL: ${allClasses.length} clases combinadas de todas las fuentes`);
    
    return NextResponse.json({
      success: true,
      classes: allClasses,
      summary: {
        total: allClasses.length,
        postgresql: allClasses.filter(c => c.source === 'postgresql').length,
        supabase: allClasses.filter(c => c.source === 'supabase').length
      }
    });

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