// src/app/api/grade-submission/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- El Prompt Maestro (se mantiene igual) ---
const MASTER_PROMPT = `
ROL Y OBJETIVO:
Eres "Profe-Bot", un especialista en pedagogía...
... (pega aquí tu MASTER_PROMPT completo)
`;

// Esta línea es crucial para que Vercel no cachee esta ruta
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Validación de Entrada
    const body = await req.json();
    const { submissionId } = body;
    if (!submissionId || typeof submissionId !== 'string') {
      return NextResponse.json({ ok: false, error: 'submissionId inválido o ausente' }, { status: 400 });
    }

    // 2. Seguridad y Autenticación (¡IMPORTANTE!)
    // En un entorno Next.js con Supabase Auth Helpers, obtendríamos al usuario así.
    // Por ahora, asumimos que el frontend ya ha validado al usuario.
    // const supabaseUserClient = createRouteHandlerClient({ cookies });
    // const { data: { user } } = await supabaseUserClient.auth.getUser();
    // if (!user) {
    //   return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    // }

    // 3. Crear Cliente Admin de Supabase
    // Asegúrate de tener estas variables en Vercel Environment Variables
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 4. Lógica Principal (adaptada de tu Edge Function)
    console.log(`Iniciando calificación para la entrega ID: ${submissionId}`);

    // Obtener la entrega y el solucionario
    const { data: submission, error: subError } = await supabaseAdmin
      .from('submissions')
      .select('submission_file_url, student_id, exam_id, exams!inner(id, solution_file_url, name)')
      .eq('id', submissionId)
      .single();

    if (subError) throw new Error(`Error al buscar la entrega: ${subError.message}`);
    if (!submission?.exams?.solution_file_url) throw new Error('El examen no tiene un solucionario subido.');

    // Descargar archivos (la lógica cambia ligeramente)
    const solutionPath = new URL(submission.exams.solution_file_url).pathname.split('/exam_files/')[1];
    const submissionPath = new URL(submission.submission_file_url).pathname.split('/exam_files/')[1];

    const { data: solutionBlob, error: solutionError } = await supabaseAdmin.storage.from('exam_files').download(solutionPath);
    const { data: submissionBlob, error: submissionError } = await supabaseAdmin.storage.from('exam_files').download(submissionPath);

    if (solutionError || submissionError) throw new Error('Error al descargar uno de los archivos PDF.');
    if (!solutionBlob || !submissionBlob) throw new Error('Uno de los archivos descargados está vacío.');

    // Llamada a Gemini (la lógica es casi idéntica, pero sin Deno)
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

    // Actualizar la base de datos
    await supabaseAdmin.from('submissions').update({ status: 'graded', ai_feedback: responseJson }).eq('id', submissionId);

    // Insertar en la tabla 'grades'
    await supabaseAdmin.from('grades').insert({
      student_id: submission.student_id, // ¡Ahora usamos el student_id real!
      exam_id: submission.exam_id,
      score_obtained: responseJson.informe_evaluacion.resumen_general.puntuacion_total_obtenida,
      score_possible: responseJson.informe_evaluacion.resumen_general.puntuacion_total_posible,
      ai_feedback: responseJson
    });

    console.log('¡Calificación completada con éxito!');
    return NextResponse.json({ ok: true, feedback: responseJson });

  } catch (error: any) {
    // 5. Manejo Uniforme de Errores
    console.error('[GRADE-SUBMISSION-ERROR]', error);
    return NextResponse.json({ ok: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}