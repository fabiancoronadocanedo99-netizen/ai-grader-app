// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log("Process CSV Function started")

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const { csvData, classId } = await req.json()
    
    if (!csvData || !classId) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: csvData and classId' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      )
    }

    // Validate classId is either a number or a valid UUID
    const isNumber = /^\d+$/.test(classId)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId)
    
    if (!isNumber && !isUUID) {
      return new Response(
        JSON.stringify({ 
          error: 'classId must be a valid number or UUID' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      )
    }

    // Create Supabase client for auth check
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization')!
          }
        }
      }
    )

    // Verify user authentication and authorization
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required' 
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      )
    }

    // Verify user owns/teaches the class
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id')
      .eq('id', classId)
      .eq('teacher_id', user.id)
      .single()

    if (classError || !classData) {
      return new Response(
        JSON.stringify({ 
          error: 'Class not found or access denied' 
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      )
    }

    // Create Supabase Admin client for inserts
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse CSV data
    const lines = csvData.trim().split('\n')
    
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ 
          error: 'CSV debe contener al menos una fila de encabezados y una de datos' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      )
    }

    // Get headers and validate
    const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase())
    const expectedHeaders = ['full_name', 'student_email', 'tutor_email']
    
    if (!expectedHeaders.every(header => headers.includes(header))) {
      return new Response(
        JSON.stringify({ 
          error: `CSV debe contener los encabezados: ${expectedHeaders.join(', ')}` 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
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
          class_id: classId
        })
      }
    }

    if (students.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No se encontraron filas válidas en el CSV' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
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
        console.error('Error inserting student:', error)
        errors.push(`${student.full_name}: ${error.message}`)
        continue
      }

      if (data && data.length > 0) {
        studentsAdded++
      }
    }

    // Check if operation was successful
    if (studentsAdded === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No se pudieron insertar alumnos en la base de datos',
          details: errors.slice(0, 3) // Show first 3 errors
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      )
    }

    // Return success response (partial or full success)
    return new Response(
      JSON.stringify({ 
        success: true,
        studentsAdded: studentsAdded,
        totalProcessed: students.length,
        errors: errors.length > 0 ? `${errors.length} estudiantes no se pudieron procesar` : undefined
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )

  } catch (error) {
    console.error('Error in process-csv function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Error interno del servidor al procesar el CSV' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/process-csv' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"csvData":"full_name,student_email,tutor_email\nJuan Pérez,juan@student.com,maria@tutor.com","classId":"1"}'

*/