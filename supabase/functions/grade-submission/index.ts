// Importar las herramientas necesarias
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.15.0'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

// --- El Prompt Maestro ---
// (He acortado el prompt aquí para la respuesta, pero el tuyo completo está bien)
const MASTER_PROMPT = `
ROL Y OBJETIVO: Eres "Profe-Bot", un especialista en pedagogía y didáctica... (Tu prompt completo va aquí)
...
{
  "informe_evaluacion": { ... }
}
`

// --- El Código Principal de la Función ---
serve(async (req) => {
  // Manejar la petición pre-vuelo (preflight) de CORS, crucial para la comunicación
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { submissionId } = await req.json()
    if (!submissionId) throw new Error('No se proporcionó el ID de la entrega (submissionId).')

    // Corregido: Usamos backticks para la interpolación de strings
    console.log(`Iniciando calificación para la entrega ID: ${submissionId}`)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: submission, error: subError } = await supabaseAdmin
      .from('submissions')
      .select('submission_file_url, exams!inner(solution_file_url, name)')
      .eq('id', submissionId)
      .single()

    if (subError) throw new Error(`Error al buscar la entrega: ${subError.message}`)
    if (!submission?.exams?.solution_file_url) throw new Error('El examen no tiene un solucionario subido.')

    // Extraer la ruta relativa correctamente, quitando el prefijo de la URL pública
    const solutionPath = new URL(submission.exams.solution_file_url).pathname.split('/exam_files/')[1]
    const submissionPath = new URL(submission.submission_file_url).pathname.split('/exam_files/')[1]

    console.log('Descargando archivos desde Storage...')
    const { data: solutionBlob, error: solutionError } = await supabaseAdmin.storage
      .from('exam_files').download(solutionPath)
    const { data: submissionBlob, error: submissionError } = await supabaseAdmin.storage
      .from('exam_files').download(submissionPath)

    if (solutionError || submissionError) throw new Error('Error al descargar uno de los archivos PDF desde el Storage.')

    console.log('Enviando petición a Gemini...')
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) throw new Error('La API Key de Gemini no está configurada.')

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" })

    const finalPrompt = MASTER_PROMPT
      .replace('"YYYY-MM-DD"', `"${new Date().toISOString().split('T')[0]}"`)
      .replace('"ID_DEL_EXAMEN"', `"${submission.exams.name}"`)

    const result = await model.generateContent([
      finalPrompt,
      { text: "solucionario.pdf" },
      { inlineData: { data: btoa(String.fromCharCode(...new Uint8Array(await solutionBlob.arrayBuffer()))), mimeType: 'application/pdf' } },
      { text: "entrega_alumno.pdf" },
      { inlineData: { data: btoa(String.fromCharCode(...new Uint8Array(await submissionBlob.arrayBuffer()))), mimeType: 'application/pdf' } }
    ])

    const responseText = result.response.text().replace(/```json|```/g, '').trim()
    const responseJson = JSON.parse(responseText)
    console.log('Respuesta recibida de Gemini:', responseJson)

    const { error: updateError } = await supabaseAdmin
      .from('submissions')
      .update({
        status: 'graded',
        ai_feedback: responseJson
      })
      .eq('id', submissionId)

    if (updateError) throw new Error(`Error al guardar la calificación: ${updateError.message}`)

    console.log('¡Calificación completada con éxito!')
    return new Response(JSON.stringify({ success: true, feedback: responseJson }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error fatal en la Edge Function:', error)
    // Corregido: Usamos backticks para la interpolación
    return new Response(JSON.stringify({ error: `Error en la función: ${(error as Error).message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})