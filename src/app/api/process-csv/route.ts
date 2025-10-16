import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log("🚀 API Route - Process CSV started")

    const body = await request.json()
    const { csvData, classId } = body

    if (!csvData || !classId) {
      return NextResponse.json(
        { error: 'Missing required fields: csvData and classId' },
        { status: 400 }
      )
    }

    // Obtener token del header
    const authHeader = request.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Crear cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verificar token y obtener usuario
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error("🚨 Auth error:", authError)
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    console.log("✅ User authenticated:", user.id)

    // Verificar que el usuario sea dueño de la clase
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id')
      .eq('id', classId)
      .eq('user_id', user.id)
      .single()

    if (classError || !classData) {
      console.error("🚨 Class access error:", classError)
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
    const students: any[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = line.split(',').map((v: string) => v.trim())

      const fullName = values[headers.indexOf('full_name')] || ''
      const studentEmail = values[headers.indexOf('student_email')] || ''
      const tutorEmail = values[headers.indexOf('tutor_email')] || null

      if (fullName && studentEmail) {
        students.push({
          full_name: fullName,
          student_email: studentEmail,
          tutor_email: tutorEmail,
          class_id: classId
        })
      }
    }

    if (students.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron estudiantes válidos en el CSV' },
        { status: 400 }
      )
    }

    console.log("📊 Students to insert:", students.length)

    // Insertar estudiantes
    let studentsAdded = 0
    const errors: string[] = []

    for (const student of students) {
      const { data, error } = await supabase
        .from('students')
        .insert([student])
        .select()

      if (error) {
        console.error('❌ Error:', error)
        errors.push(`${student.full_name}: ${error.message}`)
      } else if (data && data.length > 0) {
        studentsAdded++
        console.log("✅ Added:", student.full_name)
      }
    }

    if (studentsAdded === 0) {
      return NextResponse.json(
        { error: 'No se pudieron insertar alumnos', details: errors.slice(0, 3) },
        { status: 500 }
      )
    }

    console.log("🎉 Complete:", studentsAdded, "students added")

    return NextResponse.json({
      success: true,
      studentsAdded,
      totalProcessed: students.length,
      errors: errors.length > 0 ? `${errors.length} estudiantes fallaron` : undefined
    })

  } catch (error) {
    console.error('🚨 Critical error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}