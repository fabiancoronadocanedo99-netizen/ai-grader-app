import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();

    // 1. Cliente AUTH (Para saber quién eres)
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value },
          set(name, value, options) {},
          remove(name, options) {},
        },
      }
    );

    // 2. Cliente DATA (MODO DIOS - Service Role)
    // Este cliente ignora las reglas RLS. Si el dato existe, lo trae.
    const supabaseData = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, 
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value },
          set(name, value, options) {},
          remove(name, options) {},
        },
      }
    );

    // --- LÓGICA ---

    // A. Verificar Usuario
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    // B. Obtener Perfil (Usando MODO DIOS para asegurar lectura)
    const { data: profile, error: profileError } = await supabaseData
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error("Error perfil:", profileError);
      return NextResponse.json({ error: 'Error cargando perfil' }, { status: 500 });
    }

    // C. Validaciones
    if (profile.role !== 'admin') return NextResponse.json({ error: 'No eres admin' }, { status: 403 });
    if (!profile.organization_id) return NextResponse.json({ error: 'Sin organización' }, { status: 400 });

    const orgId = profile.organization_id;

    // D. Obtener Organización (Usando MODO DIOS)
    // Usamos maybeSingle() para que no explote si no existe, y poder dar un error legible.
    const orgRes = await supabaseData.from('organizations').select('*').eq('id', orgId).maybeSingle();

    if (orgRes.error) throw new Error("DB Error Org: " + orgRes.error.message);

    // AQUÍ ESTÁ LA CLAVE: Si devuelve null, es que la organización se borró.
    if (!orgRes.data) {
      return NextResponse.json({ 
        error: `La organización (ID: ${orgId}) asignada a tu usuario no existe en la base de datos.` 
      }, { status: 404 });
    }

    // E. Obtener resto de datos
    const [usersRes, classesRes] = await Promise.all([
      supabaseData.from('profiles').select('*').eq('organization_id', orgId),
      supabaseData.from('classes').select('*').eq('organization_id', orgId)
    ]);

    return NextResponse.json({
      organization: orgRes.data,
      users: usersRes.data || [],
      classes: classesRes.data || [],
    });

  } catch (error: any) {
    console.error('CRITICAL API ERROR:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}