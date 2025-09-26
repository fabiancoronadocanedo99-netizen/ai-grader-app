import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // Crear cliente de Supabase con el token del usuario
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

    // Paso 1: Asegurar que existe el perfil del usuario usando RPC
    console.log('📝 Verificando/creando perfil de usuario...');
    const { data: profileResult, error: profileError } = await supabase
      .rpc('ensure_user_profile', {
        p_user_id: user.id,
        p_full_name: user.email || 'Usuario'
      });
    
    if (profileError) {
      console.error('❌ Error asegurando perfil:', profileError);
      return NextResponse.json(
        { error: 'Error al crear perfil: ' + profileError.message }, 
        { status: 500 }
      );
    }

    console.log('✅ Perfil asegurado:', profileResult);

    // Paso 2: Crear la clase usando RPC que evita el cache del esquema
    console.log('🏫 Creando clase con RPC...');
    const { data: newClass, error: classError } = await supabase
      .rpc('create_class_for_user', {
        class_name: className.trim(),
        user_id: user.id
      });

    if (classError) {
      console.error('❌ Error creando clase con RPC:', classError);
      return NextResponse.json(
        { 
          error: 'Error al crear la clase: ' + classError.message,
          code: classError.code,
          details: classError.details
        }, 
        { status: 500 }
      );
    }

    console.log('✅ Clase creada exitosamente con RPC:', newClass);
    return NextResponse.json({
      success: true,
      message: 'Clase creada exitosamente',
      class: newClass
    });

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