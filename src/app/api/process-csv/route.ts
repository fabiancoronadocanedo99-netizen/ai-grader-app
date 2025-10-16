import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log("🚀 Next.js API Route - Process CSV started")

    const body = await request.json()
    const { csvData, classId } = body

    console.log("Request received:", { 
      hasCsvData: !!csvData, 
      classId: classId,
      classIdType: typeof classId 
    })

    if (!csvData || !classId) {
      return NextResponse.json(
        { 
          error: 'Missing required fields: csvData and classId',
          received: { csvData: !!csvData, classId: classId }
        },
        { status: 400 }
      )
    }

    // Create Supabase client for auth check
    const supabase = createRouteHandlerClient({ cookies })

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("🚨 Auth error:", authError)
      return NextResponse.json(
        { error: 'Authentication required', details: authError?.message },
        { status: 401 }
      )
    }

    console.log("✅ User authenticated:", user.id)

    // Verify user owns the class
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id')
      .eq('id', classId)
      .eq('user_id', user.id)
      .single()

    if (classError || !classData) {
      console.error("🚨 Class access error:", classError)
      return NextResponse.json(
        { 
          error: 'Class not found or access denied',
          details: classError?.message
        },
        { status: 403 }
      )
    }

    console.log("✅ Class access verified:", classData.id)

    // Create Supabase Admin client for inserts
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Parse CSV data
    const lines = csvData.trim().split('\n')

    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV debe contener al menos una fila de encabezados y una de datos' },
        { status: 400 }
      )
    }

    // Get headers and validate
    const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase())
    const expectedHeaders = ['full_name', 'student_email', 'tutor_email']

    if (!expectedHeaders.every(header => headers.includes(header))) {
      return NextResponse.json(
        { error: `CSV debe contener los encabezados: ${expectedHeaders.join(', ')}` },
        { status: 400 }
      )
    }

    // Parse data rows
    const students: any[] = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue // Skip empty lines

      const values = line.split(',').map((v: string) => v.trim())

      if (values.length < 2) continue // Skip invalid rows

      const fullName = values[headers.indexOf('full_name')] || ''
      const studentEmail = values[headers.indexOf('student_email')] || ''
      const tutorEmail = values[headers.indexOf('tutor_email')] || null

      // Validate required fields
      if (fullName && studentEmail) {
        students.push({
          full_name: fullName,
          student_email: studentEmail,
          tutor_email: tutorEmail,
          class_id: classId
        })
      }
    }

    console.log("📊 Students parsed:", students.length)

    if (students.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron filas válidas en el CSV' },
        { status: 400 }
      )
    }

    // Insert students into database using admin client
    let studentsAdded = 0
    const errors: string[] = []

    for (const student of students) {
      const { data, error } = await supabaseAdmin
        .from('students')
        .insert([student])
        .select()

      if (error) {
        console.error('❌ Error inserting student:', error)
        errors.push(`${student.full_name}: ${error.message}`)
        continue
      }

      if (data && data.length > 0) {
        studentsAdded++
        console.log("✅ Student added:", student.full_name)
      }
    }

    // Check if operation was successful
    if (studentsAdded === 0) {
      return NextResponse.json(
        { 
          error: 'No se pudieron insertar alumnos en la base de datos',
          details: errors.slice(0, 3)
        },
        { status: 500 }
      )
    }

    console.log("🎉 CSV Processing complete:", { studentsAdded, totalProcessed: students.length })

    return NextResponse.json(
      { 
        success: true,
        studentsAdded: studentsAdded,
        totalProcessed: students.length,
        errors: errors.length > 0 ? `${errors.length} estudiantes no se pudieron procesar` : undefined
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('🚨 Critical error in process-csv API:', error)

    return NextResponse.json(
      { 
        error: 'Error interno del servidor al procesar el CSV',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}