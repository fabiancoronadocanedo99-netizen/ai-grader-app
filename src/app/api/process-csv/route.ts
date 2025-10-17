import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log("🚀 API Route - Process CSV started");

    // --- NUEVO BLOQUE DE SEGURIDAD MANUAL ---
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("🚨 Auth error:", authError);
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    console.log("✅ User authenticated:", user.id);
    // ------------------------------------

    const body = await request.json();
    const { csvData, classId } = body;

    // ... (El resto de tu lógica para verificar la clase y procesar el CSV se mantiene igual) ...

  } catch (error) {
    // ... (El catch se mantiene igual)
  }
}