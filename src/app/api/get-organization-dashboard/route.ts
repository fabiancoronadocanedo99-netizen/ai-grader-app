import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();

    // --- 1. PREPARACIÓN DE VARIABLES DE ENTORNO ---
    // Buscamos la URL y la Key en cualquiera de sus variantes para evitar errores de nombres en Vercel
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Logs de depuración para ver qué está leyendo el servidor (sin mostrar claves completas)
    console.log("--- DEBUG ENV VARS ---");
    console.log("URL Defined:", !!supabaseUrl);
    console.log("Anon Key Defined:", !!supabaseAnonKey);
    console.log("Service Key Defined:", !!supabaseServiceKey);
    // Verificamos que la Service Key no sea igual a la Anon Key (error común)
    if (supabaseServiceKey === supabaseAnonKey) {
      console.error("CRITICAL: La Service Role Key es idéntica a la Anon Key. Revisa tus variables en Vercel.");
    }

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Error de configuración del servidor: Faltan variables de entorno.' }, { status: 500 });
    }

    // --- 2. CLIENTES SUPABASE ---

    // Cliente AUTH (Identidad del usuario)
    const supabaseAuth = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value },
          set(name, value, options) {}, // Auth solo lee en GET
          remove(name, options) {},
        },
      }
    );

    // Cliente DATA (Modo Admin / Service Role)
    const supabaseData = createServerClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value },
          set(name, value, options) {},
          remove(name, options) {},
        },
      }
    );

    // --- 3. LÓGICA DE NEGOCIO ---

    // A. Verificar Usuario
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado - Sesión no encontrada' }, { status: 401 });
    }

    // B. Obtener Perfil (Usando MODO ADMIN para asegurar lectura)
    const { data: profile, error: profileError } = await supabaseData
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error("Error cargando perfil:", profileError);
      return NextResponse.json({ error: 'No se pudo cargar el perfil del usuario' }, { status: 500 });
    }

    // C. Validaciones
    if (profile.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado: No eres admin' }, { status: 403 });
    }

    if (!profile.organization_id) {
      return NextResponse.json({ error: 'El usuario no tiene organización asignada' }, { status: 400 });
    }

    const orgId = profile.organization_id;

    // D. Obtener Organización (Usando MODO ADMIN)
    console.log(`--- DEBUG: Buscando Org ID: ${orgId} ---`);

    const orgRes = await supabaseData
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle(); // maybeSingle no explota si es null

    if (orgRes.error) {
      console.error("DB Error Org:", orgRes.error);
      throw new Error("Error consultando base de datos: " + orgRes.error.message);
    }

    if (!orgRes.data) {
      console.error(`CRITICAL: Org ID ${orgId} no encontrada en DB (URL: ${supabaseUrl})`);
      return NextResponse.json({ 
        error: `La organización (ID: ${orgId}) asignada a tu usuario no existe en la base de datos conectada.` 
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
    console.error('API DASHBOARD ERROR:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}