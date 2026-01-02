import { NextRequest, NextResponse } from 'next/server';
// Usamos el cliente de SSR solo para leer la cookie del usuario
import { createServerClient, type CookieOptions } from '@supabase/ssr';
// Usamos el cliente RAW de Supabase para los datos (Garantiza Bypass RLS)
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Faltan variables de entorno (URL o Service Key)' }, { status: 500 });
    }

    // 1. CLIENTE AUTH (Identifica al usuario que hace la petición)
    const supabaseAuth = createServerClient(
      supabaseUrl,
      supabaseAnonKey!,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value },
          set(name, value, options) {},
          remove(name, options) {},
        },
      }
    );

    // 2. CLIENTE DATA (MODO DIOS REAL)
    // Usamos la librería base 'supabase-js' que respeta estrictamente la Service Key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // --- A. Verificar quién llama ---
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado - Sesión no encontrada' }, { status: 401 });
    }

    // --- B. Obtener Perfil (Usando Admin) ---
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error("Error perfil:", profileError);
      return NextResponse.json({ error: 'No se pudo cargar el perfil' }, { status: 500 });
    }

    if (profile.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado: No eres admin' }, { status: 403 });
    }

    const orgId = profile.organization_id;

    // --- C. Obtener Organización (Usando Admin) ---
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle();

    if (orgError) {
      throw new Error("Error DB Org: " + orgError.message);
    }

    // Si sigue saliendo null aquí, es un problema de ID incorrecto en la BD 100%
    if (!orgData) {
      // Intento de debug final: listar todo lo que ve el admin
      const { data: allOrgs } = await supabaseAdmin.from('organizations').select('id, name');
      return NextResponse.json({ 
        error: `Organización ${orgId} no encontrada. El Admin ve estas organizaciones: ${JSON.stringify(allOrgs)}` 
      }, { status: 404 });
    }

    // --- D. Cargar resto de datos ---
    const [usersRes, classesRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('organization_id', orgId),
      supabaseAdmin.from('classes').select('*').eq('organization_id', orgId)
    ]);

    return NextResponse.json({
      organization: orgData,
      users: usersRes.data || [],
      classes: classesRes.data || [],
    });

  } catch (error: any) {
    console.error('API ERROR:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}