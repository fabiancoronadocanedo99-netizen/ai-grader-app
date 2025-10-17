import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log("🚀 API Route - Process CSV started")

    // Obtener el token del header Authorization
    const authHeader = request.headers.get('authorization')
    console.log("📝 Authorization header:", authHeader ? 'Present' : 'Missing')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("❌ No authorization header found")
      return NextResponse.json(
        { error: 'Authentication required - No token provided' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    console.log("🔑 Token extracted, length:", token.length)

    // Crear cliente Supabase Admin
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verificar el token y obtener el usuario
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error("❌ Token verification failed:", authError)
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    console.log("✅ User authenticated:", user.id)

    // Obtener datos del body
    const body = await request.json()
    const { csvData, classId } = body

    if (!csvData || !classId) {
      return NextResponse.json(
        { error: 'Missing required fields: csvData and classId' },
        { status: 400 }
      )
    }

    // Verificar que el usuario sea dueño de la clase
    const { data: classData, error: classError } = await supabaseAdmin
      .from('classes')
      .select('id')
      .eq('id', classId)
      .eq('user_id', user.id)
      .single()

    if (classError || !classData) {
      console.error("❌ Class access error:", classError)
      return NextResponse.json(
        { error: 'Class not found or access denied' },
        { status: 403 }
      )
    }

    console.log("✅ Class access verified")

    // Parsear CSV
    const lines = csvData.trim().split('\n')

    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV debe contener al menos encabezados y una fila de datos' },
        { status: 400 }
      )
    }

    const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase())
    const expectedHeaders = ['full_name', 'student_email', 'tutor_email']

    if (!expectedHeaders.every(h => headers.includes(h))) {
      return NextResponse.json(
        { error: `CSV debe contener: ${expectedHeaders.join(', ')}` },
        { status: 400 }
      )
    }

    // Procesar estudiantes
    const studentsToInsert: any[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = line.split(',').map((v: string) => v.trim())

      const fullName = values[headers.indexOf('full_name')] || ''
      const studentEmail = values[headers.indexOf('student_email')] || ''
      const tutorEmail = values[headers.indexOf('tutor_email')] || null

      if (fullName && studentEmail) {
        studentsToInsert.push({
          full_name: fullName,
          student_email: studentEmail,
          tutor_email: tutorEmail,
          class_id: classId
        })
      }
    }

    if (studentsToInsert.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron estudiantes válidos en el CSV' },
        { status: 400 }
      )
    }

    console.log("📊 Students to insert:", studentsToInsert.length)

    // Insertar estudiantes en batch
    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from('students')
      .insert(studentsToInsert)
      .select()

    if (insertError) {
      console.error('❌ Error inserting students:', insertError)
      return NextResponse.json(
        { error: 'No se pudieron insertar los alumnos', details: insertError.message },
        { status: 500 }
      )
    }

    const studentsAdded = insertedData?.length || 0
    console.log("🎉 Success! Students added:", studentsAdded)

    return NextResponse.json({
      success: true,
      studentsAdded: studentsAdded,
      totalProcessed: studentsToInsert.length,
    })

  } catch (error) {
    console.error('🚨 Critical error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}