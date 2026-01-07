import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
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
      return NextResponse.json({ error: 'Faltan variables de entorno' }, { status: 500 });
    }

    // 1. CLIENTE AUTH (Tipado para eliminar errores de TS)
    const supabaseAuth = createServerClient(
      supabaseUrl,
      supabaseAnonKey!,
      {
        cookies: {
          get(name: string) { 
            return cookieStore.get(name)?.value 
          },
          set(name: string, value: string, options: CookieOptions) {
            // En Route Handlers de GET no se suelen setear cookies, pero dejamos el tipo
          },
          remove(name: string, options: CookieOptions) {
            // Idem para remove
          },
        },
      }
    );

    // 2. CLIENTE DATA (MODO DIOS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // --- A. Verificar sesión ---
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // --- B. Obtener Perfil ---
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 500 });
    }

    // --- CORRECCIÓN DE ROL: Permitir admin y superadmin ---
    if (profile.role !== 'admin' && profile.role !== 'superadmin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const orgId = profile.organization_id;

    if (!orgId) {
      return NextResponse.json({ error: 'Usuario no vinculado a ninguna organización' }, { status: 400 });
    }

    // --- C. Obtener Organización ---
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle();

    if (orgError) throw new Error("Error DB Org: " + orgError.message);

    if (!orgData) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 });
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