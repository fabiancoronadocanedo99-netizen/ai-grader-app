import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js' // Mantenemos este para el admin

export async function POST(request: NextRequest) {
  try {
    console.log("🚀 Next.js API Route - Process CSV started")

    // Parse request body
    const body = await request.json()
    const { csvData } = body
    const raw = String(body.classId ?? "").trim()
    
    // Enhanced logging for debugging
    console.log("classId_received", {raw, type: typeof body.classId, body: body})
    
    if (!csvData || !raw) {
      return NextResponse.json(
        { 
          error: 'Missing required fields: csvData and classId',
          received: { csvData: !!csvData, classId: raw }
        },
        { status: 400 }
      )
    }

    // Validate classId is either a number or a valid UUID
    const isNumber = /^\d+$/.test(raw)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)
    
    console.log("classId_validation", {raw, isNumber, isUUID})
    
    if (!isNumber && !isUUID) {
      return NextResponse.json(
        { 
          error: 'classId must be a valid number or UUID',
          received: raw,
          validation: { isNumber, isUUID }
        },
        { status: 400 }
      )
    }
    
    // Normalize classId for database query
    const classIdForQuery = isNumber ? parseInt(raw, 10) : raw
    console.log("🎯 classId normalized:", classIdForQuery)

    // Create Supabase client for auth check
    const supabase = createRouteHandlerClient({ cookies });

    // Verify user authentication and authorization
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error("🚨 Auth error:", authError)
      return NextResponse.json(
        { error: 'Authentication required', details: authError?.message },
        { status: 401 }
      )
    }

    console.log("✅ User authenticated:", user.id)

    // Verify user owns/teaches the class
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id')
      .eq('id', classIdForQuery)  // Use normalized classId
      .eq('user_id', user.id)  // Fixed: usar user_id en lugar de teacher_id
      .single()

    if (classError || !classData) {
      console.error("🚨 Class access error:", classError)
      return NextResponse.json(
        { 
          error: 'Class not found or access denied',
          details: classError?.message,
          classId: classIdForQuery,
          userId: user.id
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
      const values = lines[i].split(',').map((v: string) => v.trim())
      
      if (values.length !== headers.length) {
        continue // Skip invalid rows
      }

      const student: any = {}
      headers.forEach((header: string, index: number) => {
        student[header] = values[index]
      })

      // Validate required fields
      if (student.full_name && student.student_email) {
        students.push({
          full_name: student.full_name,
          student_email: student.student_email,
          tutor_email: student.tutor_email || null,
          class_id: classIdForQuery  // Use normalized classId
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
          details: errors.slice(0, 3) // Show first 3 errors
        },
        { status: 500 }
      )
    }

    console.log("🎉 CSV Processing complete:", { studentsAdded, totalProcessed: students.length })

    // Return success response (partial or full success)
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