import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGeminiApiKey, getSupabaseConfig } from '@/config/env';
import pdf from 'pdf-parse';

// ¡ESTA LÍNEA ES CRÍTICA!
export const dynamic = 'force-dynamic';

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
    "metadatos": { "nombre_alumno": "Juan Pérez", "fecha_evaluacion": "YYYY-MM-DD", "id_examen": "ID_DEL_EXAMEN" },
    "resumen_general": { "puntuacion_total_obtenida": 18, "puntuacion_total_posible": 30, "preguntas_correctas": 1, "preguntas_incorrectas": 1, "preguntas_parciales": 1, "tipos_de_error_frecuentes": { "conceptual": 1, "calculo": 1, "procedimiento": 0, "aplicacion_de_formula": 0, "ilegible_incompleto": 0 } },
    "evaluacion_detallada": [ { "pregunta_id": "P1", "tema": "Resolución de Ecuación Cuadrática", "evaluacion": "CORRECTO", "puntuacion_obtenida": 10, "puntuacion_posible": 10, "tipo_de_error": "ninguno", "feedback": { "refuerzo_positivo": "¡Fantástico trabajo, Juan! Tu resolución de la ecuación cuadrática es impecable de principio a fin.", "area_de_mejora": null, "explicacion_del_error": null, "sugerencia_de_estudio": null } } ]
  }
}
`;

export async function POST(req: NextRequest) {
  // --- CÓDIGO ESPÍA TEMPORAL ---
  if (req.nextUrl.searchParams.get('testenv') === 'true') {
    return NextResponse.json({
      hasResendKey: !!process.env.RESEND_API_KEY,
      hasEmailKey: !!process.env.EMAIL_API_KEY,
      hasGoogleKey: !!process.env.GOOGLE_AI_API_KEY,
    });
  }

  try {
    const apiKey = getGeminiApiKey();
    const supabaseConfig = getSupabaseConfig();

    console.log('=== DEBUG ===');
    console.log('API Key encontrada:', !!apiKey);
    console.log('Supabase URL:', !!supabaseConfig.url);
    console.log('=============');

    const body = await req.json();
    const { submissionId } = body;

    if (!submissionId || typeof submissionId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'submissionId inválido o ausente' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      supabaseConfig.url!,
      supabaseConfig.serviceRoleKey!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log(`🚀 Iniciando calificación para la entrega ID: ${submissionId}`);

    // =========================================================================
    // PASO 1: OBTENER DATOS DE LA ENTREGA Y EL EXAMEN
    // =========================================================================
    type SubmissionWithExam = {
      submission_file_url: string;
      student_id: string;
      exam_id: string;
      exams: {
        id: string;
        solution_file_url: string;
        name: string;
        organization_id: string;
        teacher_id: string;
      } | null;
    };

    const { data: submission, error: subError } = await supabaseAdmin
      .from('submissions')
      .select('submission_file_url, student_id, exam_id, exams!inner(id, solution_file_url, name, organization_id, teacher_id)')
      .eq('id', submissionId)
      .single<SubmissionWithExam>();

    if (subError) {
      console.error('❌ Error al buscar la entrega:', subError);
      throw new Error(`Error al buscar la entrega: ${subError.message}`);
    }

    if (!submission?.exams?.solution_file_url) {
      throw new Error('El examen no tiene un solucionario subido.');
    }

    if (!submission.exams.organization_id || !submission.exams.teacher_id) {
      throw new Error('Faltan datos de organización o maestro en el examen.');
    }

    const organizationId = submission.exams.organization_id;
    const teacherId = submission.exams.teacher_id;

    console.log(`📋 Organization ID: ${organizationId}`);
    console.log(`👨‍🏫 Teacher ID: ${teacherId}`);

    // =========================================================================
    // PASO 2: CALCULAR EL COSTO EN CRÉDITOS (NÚMERO DE PÁGINAS DEL PDF)
    // =========================================================================
    console.log('📄 Descargando PDF de la entrega para calcular páginas...');

    const submissionPath = new URL(submission.submission_file_url).pathname.split('/exam_files/')[1];
    const { data: submissionBlob, error: submissionDownloadError } = await supabaseAdmin.storage
      .from('exam_files')
      .download(submissionPath);

    if (submissionDownloadError || !submissionBlob) {
      console.error('❌ Error al descargar el PDF de la entrega:', submissionDownloadError);
      throw new Error('Error al descargar el archivo PDF de la entrega.');
    }

    const submissionBuffer = Buffer.from(await submissionBlob.arrayBuffer());
    const pdfData = await pdf(submissionBuffer);
    const creditCost = pdfData.numpages;

    console.log(`💳 Costo calculado: ${creditCost} créditos (${creditCost} páginas)`);

    // =========================================================================
    // PASO 3: OBTENER BALANCES DE ORGANIZACIÓN Y MAESTRO
    // =========================================================================
    console.log('🏢 Consultando créditos de la organización...');

    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('credits_remaining, name')
      .eq('id', organizationId)
      .single();

    if (orgError) {
      console.error('❌ Error al obtener créditos de la organización:', orgError);
      throw new Error(`Error al obtener créditos: ${orgError.message}`);
    }

    console.log(`🏢 ${orgData.name} - Créditos disponibles: ${orgData.credits_remaining}`);

    console.log('👨‍🏫 Consultando límite y uso del maestro...');

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('monthly_credit_limit, monthly_credits_used, full_name')
      .eq('id', teacherId)
      .single();

    if (profileError) {
      console.error('❌ Error al obtener datos del maestro:', profileError);
      throw new Error(`Error al obtener datos del maestro: ${profileError.message}`);
    }

    console.log(`👨‍🏫 ${profileData.full_name} - Límite: ${profileData.monthly_credit_limit}, Usados: ${profileData.monthly_credits_used}`);

    // =========================================================================
    // PASO 4: VERIFICAR CRÉDITOS DISPONIBLES
    // =========================================================================
    console.log('🔍 Verificando disponibilidad de créditos...');

    // Verificar créditos de la organización
    if (orgData.credits_remaining < creditCost) {
      console.warn(`⚠️ Créditos insuficientes en la organización`);
      return NextResponse.json(
        {
          ok: false,
          error: 'La institución no tiene suficientes créditos.',
          credits_needed: creditCost,
          credits_available: orgData.credits_remaining,
        },
        { status: 402 }
      );
    }

    // Verificar límite mensual del maestro
    const teacherCreditsAfter = profileData.monthly_credits_used + creditCost;
    if (teacherCreditsAfter > profileData.monthly_credit_limit) {
      console.warn(`⚠️ El maestro ha excedido su límite mensual`);
      return NextResponse.json(
        {
          ok: false,
          error: 'El maestro ha excedido su límite mensual de créditos.',
          credits_needed: creditCost,
          credits_used: profileData.monthly_credits_used,
          monthly_limit: profileData.monthly_credit_limit,
        },
        { status: 403 }
      );
    }

    console.log('✅ Créditos suficientes. Procediendo con el descuento...');

    // =========================================================================
    // PASO 5: DESCONTAR CRÉDITOS (¡EL PASO CLAVE!)
    // =========================================================================
    console.log(`💰 Descontando ${creditCost} créditos de la organización...`);

    const { error: orgUpdateError } = await supabaseAdmin
      .from('organizations')
      .update({ credits_remaining: orgData.credits_remaining - creditCost })
      .eq('id', organizationId);

    if (orgUpdateError) {
      console.error('❌ Error al descontar créditos de la organización:', orgUpdateError);
      throw new Error(`Error al descontar créditos de la organización: ${orgUpdateError.message}`);
    }

    console.log(`✅ Créditos descontados de la organización (quedan ${orgData.credits_remaining - creditCost})`);

    console.log(`📊 Actualizando uso mensual del maestro...`);

    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ monthly_credits_used: teacherCreditsAfter })
      .eq('id', teacherId);

    if (profileUpdateError) {
      console.error('❌ Error al actualizar uso del maestro:', profileUpdateError);
      // Intentar revertir el descuento de la organización
      await supabaseAdmin
        .from('organizations')
        .update({ credits_remaining: orgData.credits_remaining })
        .eq('id', organizationId);
      throw new Error(`Error al actualizar uso del maestro: ${profileUpdateError.message}`);
    }

    console.log(`✅ Uso del maestro actualizado (${teacherCreditsAfter}/${profileData.monthly_credit_limit})`);

    // =========================================================================
    // PASO 6: CONTINUAR CON LA CALIFICACIÓN
    // =========================================================================
    console.log('🤖 Preparando archivos para Gemini...');

    const solutionPath = new URL(submission.exams.solution_file_url).pathname.split('/exam_files/')[1];
    const { data: solutionBlob, error: solutionError } = await supabaseAdmin.storage
      .from('exam_files')
      .download(solutionPath);

    if (solutionError || !solutionBlob) {
      console.error('❌ Error al descargar el solucionario:', solutionError);
      throw new Error('Error al descargar el solucionario.');
    }

    const solutionBuffer = Buffer.from(await solutionBlob.arrayBuffer());

    console.log('📝 Construyendo prompt para Gemini...');

    const finalPrompt = MASTER_PROMPT
      .replace('"YYYY-MM-DD"', `"${new Date().toISOString().split('T')[0]}"`)
      .replace('"ID_DEL_EXAMEN"', `"${submission.exams.name}"`);

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: finalPrompt },
            { text: 'solucionario.pdf:' },
            { inlineData: { mimeType: 'application/pdf', data: solutionBuffer.toString('base64') } },
            { text: 'entrega_alumno.pdf:' },
            { inlineData: { mimeType: 'application/pdf', data: submissionBuffer.toString('base64') } },
          ],
        },
      ],
    };

    console.log('🚀 Enviando petición a la API de Gemini...');

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Error de la API de Gemini:', JSON.stringify(errorData, null, 2));
      throw new Error(`Error de la API de Gemini: ${errorData.error?.message || 'Error desconocido'}`);
    }

    const data = await response.json();
    console.log('✅ Respuesta recibida de Gemini');

    const responseText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
    const responseJson = JSON.parse(responseText);

    console.log('💾 Actualizando base de datos...');

    // Actualizar el estado de la submission
    const { error: updateError } = await supabaseAdmin
      .from('submissions')
      .update({
        status: 'graded',
        ai_feedback: responseJson,
      })
      .eq('id', submissionId);

    if (updateError) {
      console.error('❌ Error al actualizar submission:', updateError);
      throw new Error(`Error al actualizar submission: ${updateError.message}`);
    }

    // Insertar la calificación en la tabla grades
    const { data: gradeData, error: gradeError } = await supabaseAdmin
      .from('grades')
      .insert({
        submission_id: submissionId,
        student_id: submission.student_id,
        exam_id: submission.exam_id,
        organization_id: organizationId,
        score_obtained: responseJson.informe_evaluacion.resumen_general.puntuacion_total_obtenida,
        score_possible: responseJson.informe_evaluacion.resumen_general.puntuacion_total_posible,
        ai_feedback: responseJson,
      })
      .select()
      .single();

    if (gradeError) {
      console.error('❌ Error al insertar grade:', gradeError);
      throw new Error(`Error al insertar grade: ${gradeError.message}`);
    }

    console.log('✅ Calificación guardada! Grade ID:', gradeData?.id);

    // Registrar la transacción de crédito
    console.log('📝 Registrando transacción de crédito...');

    const { error: transactionError } = await supabaseAdmin
      .from('credit_transactions')
      .insert({
        user_id: teacherId,
        organization_id: organizationId,
        credits_deducted: creditCost,
        action_type: 'grade_submission',
        entity_id: gradeData.id,
        metadata: {
          submission_id: submissionId,
          exam_id: submission.exam_id,
          exam_name: submission.exams.name,
          pages: creditCost,
          student_id: submission.student_id,
        },
      });

    if (transactionError) {
      console.error('⚠️ Error al registrar transacción:', transactionError);
    } else {
      console.log('✅ Transacción registrada exitosamente');
    }

    console.log('🎉 Proceso de calificación completado exitosamente');

    return NextResponse.json({
      ok: true,
      feedback: responseJson,
      gradeId: gradeData?.id,
      credits_deducted: creditCost,
      credits_remaining: orgData.credits_remaining - creditCost,
      teacher_credits_used: teacherCreditsAfter,
      teacher_credit_limit: profileData.monthly_credit_limit,
    });
  } catch (error: any) {
    console.error('💥 [GRADE-SUBMISSION-ERROR]', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}