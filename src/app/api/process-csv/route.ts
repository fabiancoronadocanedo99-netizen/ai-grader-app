import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log("🚀 API Route - Process CSV started");

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.log("✅ User authenticated:", user.id);

    const body = await request.json();
    const { csvData, classId } = body;

    if (!csvData || !classId) {
      return NextResponse.json({ error: 'Missing required fields: csvData and classId' }, { status: 400 });
    }

    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id')
      .eq('id', classId)
      .eq('user_id', user.id)
      .single();

    if (classError || !classData) {
      console.error("🚨 Class access error:", classError);
      return NextResponse.json({ error: 'Class not found or access denied' }, { status: 403 });
    }
    console.log("✅ Class access verified");

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV debe contener al menos encabezados y una fila de datos' }, { status: 400 });
    }

    const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase());
    const expectedHeaders = ['full_name', 'student_email', 'tutor_email'];

    if (!expectedHeaders.every(h => headers.includes(h))) {
      return NextResponse.json({ error: `CSV debe contener: ${expectedHeaders.join(', ')}` }, { status: 400 });
    }

    const studentsToInsert: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = line.split(',').map((v: string) => v.trim());
      const fullName = values[headers.indexOf('full_name')] || '';
      const studentEmail = values[headers.indexOf('student_email')] || '';
      const tutorEmail = values[headers.indexOf('tutor_email')] || null;

      if (fullName && studentEmail) {
        studentsToInsert.push({
          full_name: fullName,
          student_email: studentEmail,
          tutor_email: tutorEmail,
          class_id: classId,
          user_id: user.id
        });
      }
    }

    if (studentsToInsert.length === 0) {
      return NextResponse.json({ error: 'No se encontraron estudiantes válidos en el CSV' }, { status: 400 });
    }
    console.log("📊 Students to insert:", studentsToInsert.length);

    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from('students')
      .insert(studentsToInsert)
      .select();

    if (insertError) {
      console.error('❌ Error al insertar estudiantes:', insertError);
      return NextResponse.json({ error: 'No se pudieron insertar los alumnos', details: insertError.message }, { status: 500 });
    }

    const studentsAdded = insertedData?.length || 0;
    console.log("🎉 Complete:", studentsAdded, "students added");

    return NextResponse.json({
      success: true,
      studentsAdded: studentsAdded,
      totalProcessed: studentsToInsert.length,
    });

  } catch (error) {
    console.error('🚨 Critical error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}