import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Tipos para el query de Supabase
type GradeWithRelations = {
  score_obtained: number | null;
  score_possible: number | null;
  ai_feedback: any;
  students: {
    full_name: string;
    student_email: string | null;
    tutor_email: string | null;
  } | null;
  exams: {
    name: string;
  } | null;
}

// Función para construir el template HTML del email
function buildEmailTemplate({ studentName, grade, maxGrade, feedback, resumen, evaluaciones }: {
  studentName: string;
  grade: number;
  maxGrade: number;
  feedback: any;
  resumen: any;
  evaluaciones: any[];
}) {
  const percentage = maxGrade > 0 ? Math.round((grade / maxGrade) * 100) : 0;
  const gradeColor = percentage >= 80 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444';

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reporte de Calificación</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; }
        .container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
        .content { padding: 30px 20px; }
        .grade-summary { text-align: center; padding: 25px; background: #f8fafc; border-radius: 8px; margin-bottom: 25px; }
        .grade-score { font-size: 48px; font-weight: bold; color: ${gradeColor}; }
        .grade-text { font-size: 18px; color: #64748b; }
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 25px 0; }
        .stat-card { text-align: center; padding: 20px 15px; background: #f8fafc; border-radius: 8px; }
        .stat-number { font-size: 24px; font-weight: bold; }
        .stat-number.correct { color: #10b981; }
        .stat-number.partial { color: #f59e0b; }
        .stat-number.incorrect { color: #ef4444; }
        .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
        .section-title { font-size: 20px; font-weight: 700; color: #1e293b; margin: 30px 0 15px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;}
        .question-item { background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 15px; border-left: 4px solid #e2e8f0; }
        .question-item.correct { border-left-color: #10b981; }
        .question-item.partial { border-left-color: #f59e0b; }
        .question-item.incorrect { border-left-color: #ef4444; }
        .footer { background: #f8fafc; padding: 25px 20px; text-align: center; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1>📊 Reporte de Calificación</h1></div>
        <div class="content">
          <h2>Estimado/a ${studentName},</h2>
          <p>Te compartimos el resultado de tu evaluación:</p>
          <div class="grade-summary">
            <div class="grade-score">${grade}/${maxGrade}</div>
            <div class="grade-text">Calificación Final</div>
          </div>
          ${resumen && Object.keys(resumen).length > 0 ? `
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-number correct">✅ ${resumen.preguntas_correctas || 0}</div><div class="stat-label">Correctas</div></div>
            <div class="stat-card"><div class="stat-number partial">⚠️ ${resumen.preguntas_parciales || 0}</div><div class="stat-label">Parciales</div></div>
            <div class="stat-card"><div class="stat-number incorrect">❌ ${resumen.preguntas_incorrectas || 0}</div><div class="stat-label">Incorrectas</div></div>
          </div>
          ` : ''}
          ${evaluaciones && evaluaciones.length > 0 ? `
          <h3 class="section-title">📝 Evaluación Detallada</h3>
          ${evaluaciones.map((pregunta: any, index: number) => `
            <div class="question-item ${pregunta.evaluacion?.toLowerCase().includes('parcialmente') ? 'partial' : pregunta.evaluacion?.toLowerCase() === 'correcto' ? 'correct' : 'incorrect'}">
              <h4>${pregunta.pregunta_id || `Pregunta ${index + 1}`}</h4>
              <p>${pregunta.feedback?.refuerzo_positivo || pregunta.feedback?.explicacion_del_error || 'Sin feedback detallado.'}</p>
            </div>
          `).join('')}
          ` : ''}
        </div>
        <div class="footer"><p>Generado por AI Grader</p></div>
      </div>
    </body>
    </html>
  `;
}

// --- API ROUTE ---
export async function POST(request: NextRequest) {
  try {
    // --- Autenticación ---
    const authHeader = request.headers.get('authorization');
    const accessToken = authHeader?.replace('Bearer ', '');

    if (!accessToken) {
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Autenticación fallida' }, { status: 401 });
    }

    // --- Obtención de gradeId ---
    const { gradeId } = await request.json();

    if (!gradeId) {
      return NextResponse.json({ error: 'No se proporcionó gradeId' }, { status: 400 });
    }

    console.log(`🔍 Buscando datos para grade ID: ${gradeId}`);

    // --- Consulta con cliente ADMIN ---
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: grade, error: gradeError } = await supabaseAdmin
      .from('grades')
      .select(`
        score_obtained,
        score_possible,
        ai_feedback,
        students!inner (
          full_name,
          student_email,
          tutor_email
        ),
        exams!inner (
          name
        )
      `)
      .eq('id', gradeId)
      .single<GradeWithRelations>();

    if (gradeError || !grade) {
      console.error('❌ Error buscando la calificación:', gradeError);
      return NextResponse.json({ 
        error: 'Calificación no encontrada o acceso denegado',
        details: gradeError?.message 
      }, { status: 404 });
    }

    console.log('✅ Calificación, estudiante y examen encontrados');

    // Validar que tengamos los datos necesarios
    if (!grade.students) {
      return NextResponse.json({ error: 'Datos de estudiante no encontrados' }, { status: 404 });
    }

    if (!grade.exams) {
      return NextResponse.json({ error: 'Datos de examen no encontrados' }, { status: 404 });
    }

    const student = grade.students;
    const exam = grade.exams;

    // --- Procesamiento del feedback ---
    let parsedFeedback = grade.ai_feedback;

    if (typeof parsedFeedback === 'string') {
      try {
        parsedFeedback = JSON.parse(parsedFeedback);
      } catch (e) {
        console.warn('⚠️ No se pudo parsear ai_feedback como JSON');
        parsedFeedback = {};
      }
    }

    const feedbackData = parsedFeedback?.informe_evaluacion || parsedFeedback || {};
    const resumen = feedbackData?.resumen_general || {};
    const evaluaciones = feedbackData?.evaluacion_detallada || [];

    // --- Generar HTML del email ---
    const emailHTML = buildEmailTemplate({
      studentName: student.full_name,
      grade: grade.score_obtained || 0,
      maxGrade: grade.score_possible || resumen.puntuacion_total_posible || 100,
      feedback: feedbackData,
      resumen: resumen,
      evaluaciones: evaluaciones
    });

    // --- Validar configuración de Resend ---
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      return NextResponse.json({ error: 'Servicio de correo no configurado' }, { status: 500 });
    }

    // --- Preparar destinatarios ---
    const recipients = [
      student.student_email,
      student.tutor_email
    ].filter(Boolean) as string[];

    if (recipients.length === 0) {
      return NextResponse.json({ 
        error: 'No se encontraron emails válidos para el estudiante' 
      }, { status: 400 });
    }

    console.log(`📧 Enviando correo a: ${recipients.join(', ')}`);

    // --- Enviar email con Resend ---
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: 'AI Grader <onboarding@resend.dev>',// Cambia esto por tu dominio verificado
        to: recipients,
        subject: `Reporte de Calificación - ${exam.name}`,
        html: emailHTML
      })
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error('❌ Error de Resend:', errorData);
      return NextResponse.json({ 
        error: 'Fallo al enviar el correo', 
        details: errorData 
      }, { status: 500 });
    }

    const emailResult = await resendResponse.json();
    console.log('✅ Email enviado exitosamente:', emailResult);

    return NextResponse.json({ 
      success: true, 
      message: 'Reporte enviado exitosamente',
      emailId: emailResult.id 
    });

  } catch (error) {
    console.error('❌ Error fatal en la API de envío de correo:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}