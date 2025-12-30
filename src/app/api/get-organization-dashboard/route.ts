import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Forzamos que esta ruta sea dinámica porque depende de cookies de sesión
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  // Inicializamos el cliente. 
  // Pasamos 'cookies' directamente. La librería se encarga de llamarla.
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // 1. Verificar Autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado. Por favor inicia sesión.' },
        { status: 401 }
      );
    }

    // 2. Obtener Perfil para verificar Rol y Organization ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'No se pudo obtener el perfil del usuario.' },
        { status: 500 }
      );
    }

    // 3. Verificar Seguridad (Solo Admins)
    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren permisos de administrador.' },
        { status: 403 }
      );
    }

    if (!profile.organization_id) {
      return NextResponse.json(
        { error: 'El usuario no pertenece a ninguna organización.' },
        { status: 400 }
      );
    }

    const orgId = profile.organization_id;

    // 4. Realizar consultas de datos en paralelo (Eficiencia)
    const [orgResponse, usersResponse, classesResponse] = await Promise.all([
      // a. Detalles de la organización
      supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single(),

      // b. Usuarios de la misma organización
      supabase
        .from('profiles')
        .select('*') 
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false }),

      // c. Clases de la misma organización
      supabase
        .from('classes')
        .select('*')
        .eq('organization_id', orgId)
        .order('name', { ascending: true })
    ]);

    // Verificar si hubo errores en alguna de las consultas críticas
    if (orgResponse.error) {
      console.error('Error fetching organization:', orgResponse.error);
      return NextResponse.json({ error: 'Error obteniendo datos de la organización' }, { status: 500 });
    }

    // Si fallan usuarios o clases, reportamos error
    if (usersResponse.error) {
       console.error('Error fetching users:', usersResponse.error);
       return NextResponse.json({ error: 'Error obteniendo lista de usuarios' }, { status: 500 });
    }

    if (classesResponse.error) {
       console.error('Error fetching classes:', classesResponse.error);
       return NextResponse.json({ error: 'Error obteniendo lista de clases' }, { status: 500 });
    }

    // 5. Devolver respuesta JSON estructurada
    return NextResponse.json({
      organization: orgResponse.data,
      users: usersResponse.data,
      classes: classesResponse.data,
    });

  } catch (error: any) {
    console.error('Error interno en get-organization-dashboard:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}