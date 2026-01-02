import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr'; // Usamos la librería nueva
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();

    // 1. Crear el cliente manualmente usando @supabase/ssr
    // Esto reemplaza a createRouteHandlerClient y arregla el error de importación
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            try { cookieStore.set({ name, value, ...options }) } catch (error) {}
          },
          remove(name: string, options: CookieOptions) {
            try { cookieStore.set({ name, value: '', ...options }) } catch (error) {}
          },
        },
      }
    );

    // 2. Verificar Sesión
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      // Devolvemos JSON explícito para evitar el error "Unexpected end of JSON"
      return NextResponse.json({ error: 'No autorizado - Sesión no encontrada' }, { status: 401 });
    }

    // 3. Verificar Perfil
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'No se pudo cargar el perfil' }, { status: 500 });
    }

    // 4. Validar Admin
    if (profile.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado: No eres admin' }, { status: 403 });
    }

    if (!profile.organization_id) {
      return NextResponse.json({ error: 'El usuario no tiene organización asignada' }, { status: 400 });
    }

    const orgId = profile.organization_id;

    // 5. Cargar datos en paralelo
    const [orgRes, usersRes, classesRes] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', orgId).single(),
      supabase.from('profiles').select('*').eq('organization_id', orgId),
      supabase.from('classes').select('*').eq('organization_id', orgId)
    ]);

    if (orgRes.error) throw new Error(`Org Error: ${orgRes.error.message}`);

    // Devolvemos los datos
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