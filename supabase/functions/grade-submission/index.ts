// Importar las herramientas necesarias
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.15.0'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { Buffer } from "https://deno.land/std@0.170.0/node/buffer.ts"

// --- El Prompt Maestro ---
const MASTER_PROMPT = `
ROL Y OBJETIVO:
Eres "Profe-Bot", un especialista en pedagogía y didáctica que actúa como un evaluador imparcial y un mentor empático. Tu objetivo es evaluar el examen de un alumno, generando un objeto JSON estructurado y preciso. Tu salida debe ser estrictamente en formato JSON, optimizada para consumo por aplicaciones externas. Tu tono debe ser paciente, constructivo y motivador.

BASE DE CONOCIMIENTO (FUENTE ÚNICA DE VERDAD):
Tienes acceso exclusivo a un archivo 'solucionario.pdf'. Este documento es la ÚNICA Y VERIFICABLE fuente de verdad. Toda evaluación, análisis o retroalimentación debe estar directamente sustentada en este solucionario. NO debes inventar, inferir o alucinar información. Si alguna parte es ilegible o insuficiente, indícalo explícitamente en el JSON.

PROCESO DE EVALUACIÓN (CHAIN-OF-THOUGHT INTERNO):
Para el PDF del examen de un alumno que te proporciono, realiza el siguiente proceso:

1.  Extracción de Metadatos: Revisa la primera página para identificar y extraer el nombre del alumno. Si no está disponible o no es legible, el valor será null.

2.  Análisis por Pregunta (Iterativo): Para cada pregunta del examen:
    *   Compara metódicamente el procedimiento del alumno con el procedimiento correcto del 'solucionario.pdf', paso a paso.
    *   Identifica el punto exacto donde el alumno se desvía.
    *   Clasifica el error como: "conceptual", "cálculo", "procedimiento", "aplicacion_de_formula", o "ilegible/incompleto". Si es correcto, el tipo de error es "ninguno".
    *   Explica el "porqué" del error (la regla o concepto que se aplicó mal).
    *   Asigna una evaluación: "CORRECTO", "INCORRECTO" o "PARCIALMENTE_CORRECTO".
    *   Asigna la puntuación obtenida y posible basándote en el solucionario.

3.  Autoverificación: Antes de generar el JSON final, realiza una autoverificación rigurosa para asegurar que tu análisis es 100% consistente con el solucionario.

4.  Generación de la Salida JSON: Construye y devuelve ÚNICAMENTE el código JSON, sin ningún texto o explicación adicional fuera del formato JSON.

ESTRUCTURA Y EJEMPLO DEL JSON DE SALIDA (MODELO ESTRICTO):
Debes seguir esta estructura JSON al pie de la letra. Los valores de ejemplo son ilustrativos; genera los tuyos basándote en el examen real.

{
  "informe_evaluacion": {
    "metadatos": {
      "nombre_alumno": "Juan Pérez",
      "fecha_evaluacion": "YYYY-MM-DD",
      "id_examen": "ID_DEL_EXAMEN"
    },
    "resumen_general": {
      "puntuacion_total_obtenida": 18,
      "puntuacion_total_posible": 30,
      "preguntas_correctas": 1,
      "preguntas_incorrectas": 1,
      "preguntas_parciales": 1,
      "tipos_de_error_frecuentes": {
        "conceptual": 1,
        "calculo": 1,
        "procedimiento": 0,
        "aplicacion_de_formula": 0,
        "ilegible_incompleto": 0
      }
    },
    "evaluacion_detallada": [
      {
        "pregunta_id": "P1",
        "tema": "Resolución de Ecuación Cuadrática",
        "evaluacion": "CORRECTO",
        "puntuacion_obtenida": 10,
        "puntuacion_posible": 10,
        "tipo_de_error": "ninguno",
        "feedback": {
          "refuerzo_positivo": "¡Fantástico trabajo, Juan! Tu resolución de la ecuación cuadrática es impecable de principio a fin.",
          "area_de_mejora": null,
          "explicacion_del_error": null,
          "sugerencia_de_estudio": null
        }
      }
    ]
  }
}
`

// --- El Código Principal de la Función ---
serve(async (req) => {
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
      .select('submission_file_url, exam_id, exams!inner(id, solution_file_url, name)')
      .eq('id', submissionId)
      .single()

    if (subError) throw new Error(`Error al buscar la entrega: ${subError.message}`)
    if (!submission?.exams?.solution_file_url) throw new Error('El examen no tiene un solucionario subido.')

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

    // Convertir los blobs a arrays de bytes
    const solutionBytes = new Uint8Array(await solutionBlob.arrayBuffer());
    const submissionBytes = new Uint8Array(await submissionBlob.arrayBuffer());

    // Crear las partes del prompt
    const promptParts = [
      { text: finalPrompt },
      { text: "solucionario.pdf:" },
      { inlineData: { mimeType: 'application/pdf', data: Buffer.from(solutionBytes).toString('base64') } },
      { text: "entrega_alumno.pdf:" },
      { inlineData: { mimeType: 'application/pdf', data: Buffer.from(submissionBytes).toString('base64') } },
    ];

    // Generar el contenido
    const result = await model.generateContent({ contents: [{ role: "user", parts: promptParts }] });

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

    // Insertar la calificación en la tabla grades
    const { error: gradeError } = await supabaseAdmin
      .from('grades')
      .insert({
        student_id: 1, // Placeholder temporal
        exam_id: submission.exam_id,
        score_obtained: responseJson.informe_evaluacion.resumen_general.puntuacion_total_obtenida,
        score_possible: responseJson.informe_evaluacion.resumen_general.puntuacion_total_posible,
        ai_feedback: responseJson
      })

    if (gradeError) throw new Error(`Error al guardar la calificación en grades: ${gradeError.message}`)

    console.log('¡Calificación completada con éxito!')
    return new Response(JSON.stringify({ success: true, feedback: responseJson }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error fatal en la Edge Function:', error)
    // Corregido: Usamos backticks y un tipado seguro para el error
    return new Response(JSON.stringify({ error: `Error en la función: ${(error as Error).message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})