import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();

    // 1. Cliente para AUTENTICACIÓN (Usa cookies y Anon Key)
    // Este verifica QUIÉN es el usuario legítimamente.
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name, value, options) { try { cookieStore.set({ name, value, ...options }) } catch (e) {} },
          remove(name, options) { try { cookieStore.set({ name, value: '', ...options }) } catch (e) {} },
        },
      }
    );

    // 2. Cliente para DATOS (Usa Service Role Key)
    // Este se salta las políticas RLS para asegurar que obtenemos los datos
    // una vez que sabemos que el usuario es Admin.
    const supabaseData = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // <--- CLAVE MAESTRA
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value },
          set(name, value, options) {},
          remove(name, options) {},
        },
      }
    );

    // --- VERIFICACIÓN DE IDENTIDAD ---

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado - Sesión no encontrada' }, { status: 401 });
    }

    // Obtenemos el perfil usando el cliente Admin para evitar bloqueos RLS en la tabla profiles
    const { data: profile, error: profileError } = await supabaseData
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error("Error perfil:", profileError);
      return NextResponse.json({ error: 'No se pudo cargar el perfil del usuario' }, { status: 500 });
    }

    if (profile.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado: No eres admin' }, { status: 403 });
    }

    if (!profile.organization_id) {
      return NextResponse.json({ error: 'El usuario no tiene organización asignada' }, { status: 400 });
    }

    const orgId = profile.organization_id;

    // --- OBTENCIÓN DE DATOS (Con Cliente Admin) ---

    // Usamos maybeSingle() en lugar de single() para manejar mejor si no existe
    const [orgRes, usersRes, classesRes] = await Promise.all([
      supabaseData.from('organizations').select('*').eq('id', orgId).maybeSingle(),
      supabaseData.from('profiles').select('*').eq('organization_id', orgId),
      supabaseData.from('classes').select('*').eq('organization_id', orgId)
    ]);

    if (orgRes.error) throw new Error(`Org Error: ${orgRes.error.message}`);

    // Si orgRes.data es null, significa que el ID no existe en la BD
    if (!orgRes.data) {
       throw new Error(`La organización con ID ${orgId} no existe en la base de datos.`);
    }

    if (usersRes.error) throw new Error(`Users Error: ${usersRes.error.message}`);
    if (classesRes.error) throw new Error(`Classes Error: ${classesRes.error.message}`);

    return NextResponse.json({
      organization: orgRes.data,
      users: usersRes.data || [],
      classes: classesRes.data || [],
    });

  } catch (error: any) {
    console.error('API DASHBOARD ERROR:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}