// src/app/api/grade-submission/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
`;

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { submissionId } = body;
    if (!submissionId || typeof submissionId !== 'string') {
      return NextResponse.json({ ok: false, error: 'submissionId inválido o ausente' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log(`Iniciando calificación para la entrega ID: ${submissionId}`);

    type SubmissionWithExam = {
      submission_file_url: string;
      student_id: string;
      exam_id: string;
      exams: { id: string; solution_file_url: string; name: string; } | null;
    };

    const { data: submission, error: subError } = await supabaseAdmin
      .from('submissions')
      .select('submission_file_url, student_id, exam_id, exams!inner(id, solution_file_url, name)')
      .eq('id', submissionId)
      .single<SubmissionWithExam>();

    if (subError) throw new Error(`Error al buscar la entrega: ${subError.message}`);
    if (!submission?.exams?.solution_file_url) throw new Error('El examen no tiene un solucionario subido.');

    const solutionPath = new URL(submission.exams.solution_file_url).pathname.split('/exam_files/')[1];
    const submissionPath = new URL(submission.submission_file_url).pathname.split('/exam_files/')[1];

    const { data: solutionBlob, error: solutionError } = await supabaseAdmin.storage.from('exam_files').download(solutionPath);
    const { data: submissionBlob, error: submissionError } = await supabaseAdmin.storage.from('exam_files').download(submissionPath);

    if (solutionError || submissionError) throw new Error('Error al descargar uno de los archivos PDF.');
    if (!solutionBlob || !submissionBlob) throw new Error('Uno de los archivos descargados está vacío.');

    // --- ¡CORRECCIÓN FINAL! ---
    // Volvemos a pasar la API Key directamente, que es lo que la librería espera.
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!); 

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

    const finalPrompt = MASTER_PROMPT
      .replace('"YYYY-MM-DD"', `"${new Date().toISOString().split('T')[0]}"`)
      .replace('"ID_DEL_EXAMEN"', `"${submission.exams.name}"`);

    const solutionBuffer = Buffer.from(await solutionBlob.arrayBuffer());
    const submissionBuffer = Buffer.from(await submissionBlob.arrayBuffer());

    const promptParts = [
      { text: finalPrompt },
      { text: "solucionario.pdf:" },
      { inlineData: { mimeType: 'application/pdf', data: solutionBuffer.toString('base64') } },
      { text: "entrega_alumno.pdf:" },
      { inlineData: { mimeType: 'application/pdf', data: submissionBuffer.toString('base64') } },
    ];

    const result = await model.generateContent({ contents: [{ role: "user", parts: promptParts }] });
    const responseText = result.response.text().replace(/```json|```/g, '').trim();
    const responseJson = JSON.parse(responseText);

    await supabaseAdmin.from('submissions').update({ status: 'graded', ai_feedback: responseJson }).eq('id', submissionId);

    await supabaseAdmin.from('grades').insert({
      student_id: submission.student_id,
      exam_id: submission.exam_id,
      score_obtained: responseJson.informe_evaluacion.resumen_general.puntuacion_total_obtenida,
      score_possible: responseJson.informe_evaluacion.resumen_general.puntuacion_total_posible,
      ai_feedback: responseJson
    });

    console.log('¡Calificación completada con éxito!');
    return NextResponse.json({ ok: true, feedback: responseJson });

  } catch (error: any) {
    console.error('[GRADE-SUBMISSION-ERROR]', error);
    return NextResponse.json({ ok: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}