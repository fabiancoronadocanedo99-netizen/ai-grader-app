import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // --- CLIENTE DATA (MODO DIOS) ---
    const supabaseData = createServerClient(
      supabaseUrl!,
      supabaseServiceKey!,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value },
          set(name, value, options) {},
          remove(name, options) {},
        },
      }
    );

    // --- CLIENTE AUTH ---
    const supabaseAuth = createServerClient(
      supabaseUrl!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value },
          set(name, value, options) {},
          remove(name, options) {},
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'No Session' }, { status: 401 });

    const { data: profile } = await supabaseData
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) return NextResponse.json({ error: 'No Profile' }, { status: 500 });

    // --- LA PRUEBA DE LA VERDAD ---
    const orgId = profile.organization_id;

    console.log(`--- DEBUG: Buscando Org ID: "${orgId}" ---`); // Las comillas revelarán espacios

    const orgRes = await supabaseData
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle();

    // SI NO LA ENCUENTRA, LISTAMOS QUÉ HAY EN LA BD
    if (!orgRes.data) {
      // Consultamos las primeras 5 organizaciones que SÍ existen
      const allOrgs = await supabaseData.from('organizations').select('id, name').limit(5);

      console.error("--- DEBUG CRÍTICO: CONTENIDO REAL DE LA BD ---");
      console.table(allOrgs.data);

      return NextResponse.json({ 
        error: `ERROR DE CONEXIÓN/DATOS. Buscábamos ID: ${orgId}. 
        La Base de Datos conectada (${supabaseUrl}) contiene estas organizaciones: 
        ${JSON.stringify(allOrgs.data)}` 
      }, { status: 404 });
    }

    // Si llegamos aquí, todo está bien
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}