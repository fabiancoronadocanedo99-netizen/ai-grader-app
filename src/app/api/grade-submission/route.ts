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

    // --- ¡CAMBIO CLAVE! ---
    // La librería buscará las credenciales automáticamente en las variables de entorno
    const genAI = new GoogleGenerativeAI(); 

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