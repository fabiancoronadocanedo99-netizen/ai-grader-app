import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    console.log('📧 Iniciando envío de correo...');
    
    // Crear cliente de Supabase con autenticación del servidor
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Verificar autenticación del usuario
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session?.user) {
      return NextResponse.json(
        { error: 'Autenticación requerida' }, 
        { status: 401 }
      );
    }

    const body = await request.json();
    const { gradeId } = body;
    
    if (!gradeId) {
      return NextResponse.json(
        { error: 'No se proporcionó gradeId' }, 
        { status: 400 }
      );
    }

    console.log(`🔍 Buscando datos para submission ID: ${gradeId}`);

    // Paso 1: Obtener la submission con verificación de autorización
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', gradeId)
      .eq('user_id', session.user.id)  // Solo submissions del usuario autenticado
      .single();

    if (submissionError || !submission) {
      console.error('❌ Error buscando submission o acceso denegado');
      return NextResponse.json(
        { error: 'Submission no encontrada o acceso denegado' }, 
        { status: 404 }
      );
    }

    console.log('✅ Submission encontrada para usuario autorizado');

    // Paso 2: Obtener datos del estudiante
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('id', submission.student_id)
      .single();

    if (studentError || !student) {
      console.error('❌ Error buscando estudiante');
      return NextResponse.json(
        { error: 'Estudiante no encontrado' }, 
        { status: 404 }
      );
    }

    console.log('✅ Estudiante encontrado');

    // Paso 3: Procesar el feedback de AI
    let aiReport = submission.ai_feedback;
    if (typeof aiReport === 'string') {
      try {
        aiReport = JSON.parse(aiReport);
      } catch (e) {
        console.warn('⚠️ No se pudo parsear AI feedback JSON');
        aiReport = {};
      }
    }

    const feedbackData = aiReport?.informe_evaluacion || aiReport || {};
    const resumen = feedbackData?.resumen_general || {};
    const evaluaciones = feedbackData?.evaluacion_detallada || [];

    // Paso 4: Construir el HTML del email
    const emailHTML = buildEmailTemplate({
      studentName: student.full_name,
      grade: submission.grade || resumen.puntuacion_total_obtenida || 0,
      maxGrade: resumen.puntuacion_total_posible || 100,
      feedback: feedbackData,
      resumen: resumen,
      evaluaciones: evaluaciones
    });

    // Paso 5: Verificar API key de Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('❌ RESEND_API_KEY no configurado');
      return NextResponse.json(
        { error: 'Servicio de correo no configurado' }, 
        { status: 500 }
      );
    }

    const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'AI Grader <onboarding@resend.dev>';

    // Paso 6: Preparar destinatarios
    const recipients = [];
    if (student.student_email) recipients.push(student.student_email);
    if (student.tutor_email) recipients.push(student.tutor_email);

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron emails del estudiante o tutor' }, 
        { status: 400 }
      );
    }

    console.log(`📤 Enviando correo a ${recipients.length} destinatarios`);

    // Paso 7: Enviar email con Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: fromAddress,
        to: recipients,
        subject: `📊 Reporte de Calificación - ${student.full_name}`,
        html: emailHTML,
        text: `Reporte de Calificación para ${student.full_name}\n\nCalificación: ${submission.grade || resumen.puntuacion_total_obtenida || 0}/${resumen.puntuacion_total_posible || 100}\n\nRevisa tu correo para ver el reporte completo.`
      })
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('❌ Error de Resend API:', errorData);
      return NextResponse.json(
        { 
          error: 'Error al enviar el correo',
          details: errorData
        }, 
        { status: 500 }
      );
    }

    const emailData = await emailResponse.json();
    console.log('✅ Email enviado exitosamente');

    return NextResponse.json({
      success: true,
      message: 'Reporte enviado exitosamente',
      emailsSent: recipients.length
    });

  } catch (error) {
    console.error('❌ Error fatal en envío de correo:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: (error as Error).message
      }, 
      { status: 500 }
    );
  }
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
  const percentage = Math.round((grade / maxGrade) * 100);
  const gradeColor = percentage >= 80 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444';

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reporte de Calificación</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px 20px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 8px 0 0 0;
          opacity: 0.9;
          font-size: 16px;
        }
        .content {
          padding: 30px 20px;
        }
        .grade-summary {
          text-align: center;
          padding: 25px;
          background: #f8fafc;
          border-radius: 8px;
          margin-bottom: 25px;
        }
        .grade-score {
          font-size: 48px;
          font-weight: bold;
          color: ${gradeColor};
          margin-bottom: 8px;
        }
        .grade-text {
          font-size: 18px;
          color: #64748b;
          margin-bottom: 15px;
        }
        .percentage-badge {
          display: inline-block;
          padding: 6px 16px;
          background: ${gradeColor};
          color: white;
          border-radius: 20px;
          font-weight: 600;
          font-size: 14px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 15px;
          margin: 25px 0;
        }
        .stat-card {
          text-align: center;
          padding: 20px 15px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }
        .stat-number {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .stat-number.correct { color: #10b981; }
        .stat-number.partial { color: #f59e0b; }
        .stat-number.incorrect { color: #ef4444; }
        .stat-label {
          font-size: 12px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 600;
        }
        .section-title {
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
          margin: 30px 0 15px 0;
          padding-bottom: 8px;
          border-bottom: 2px solid #e2e8f0;
        }
        .question-item {
          background: #f8fafc;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 15px;
          border-left: 4px solid #e2e8f0;
        }
        .question-item.correct { border-left-color: #10b981; }
        .question-item.partial { border-left-color: #f59e0b; }
        .question-item.incorrect { border-left-color: #ef4444; }
        .question-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .question-title {
          font-weight: 600;
          font-size: 16px;
          color: #1e293b;
        }
        .question-score {
          font-weight: bold;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 14px;
        }
        .question-score.correct { background: #dcfce7; color: #166534; }
        .question-score.partial { background: #fef3c7; color: #92400e; }
        .question-score.incorrect { background: #fee2e2; color: #991b1b; }
        .question-feedback {
          color: #64748b;
          font-size: 14px;
          line-height: 1.5;
        }
        .footer {
          background: #f8fafc;
          padding: 25px 20px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 0;
          color: #64748b;
          font-size: 14px;
        }
        .logo {
          font-size: 24px;
          margin-right: 8px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1><span class="logo">🤖</span>Reporte de Calificación AI</h1>
          <p>Resultado de evaluación automatizada</p>
        </div>
        
        <div class="content">
          <div style="margin-bottom: 25px;">
            <h2 style="color: #1e293b; margin-bottom: 8px;">Estimado/a ${studentName},</h2>
            <p style="color: #64748b; margin: 0;">Te compartimos el resultado de tu evaluación:</p>
          </div>

          <div class="grade-summary">
            <div class="grade-score">${grade}/${maxGrade}</div>
            <div class="grade-text">Calificación Final</div>
            <div class="percentage-badge">${percentage}%</div>
          </div>

          ${resumen && Object.keys(resumen).length > 0 ? `
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-number correct">✅ ${resumen.preguntas_correctas || 0}</div>
              <div class="stat-label">Correctas</div>
            </div>
            <div class="stat-card">
              <div class="stat-number partial">⚠️ ${resumen.preguntas_parciales || 0}</div>
              <div class="stat-label">Parciales</div>
            </div>
            <div class="stat-card">
              <div class="stat-number incorrect">❌ ${resumen.preguntas_incorrectas || 0}</div>
              <div class="stat-label">Incorrectas</div>
            </div>
          </div>
          ` : ''}

          ${evaluaciones && evaluaciones.length > 0 ? `
          <h3 class="section-title">📝 Evaluación Detallada</h3>
          ${evaluaciones.map((pregunta: any, index: number) => {
            const evaluacion = pregunta.evaluacion?.toLowerCase() || '';
            const statusClass = evaluacion.includes('correcto') && !evaluacion.includes('parcialmente') 
              ? 'correct' 
              : evaluacion.includes('parcialmente') 
                ? 'partial' 
                : 'incorrect';
            
            const statusIcon = statusClass === 'correct' ? '✅' : statusClass === 'partial' ? '⚠️' : '❌';
            const statusText = statusClass === 'correct' ? 'Correcto' : statusClass === 'partial' ? 'Parcial' : 'Incorrecto';

            return `
            <div class="question-item ${statusClass}">
              <div class="question-header">
                <div class="question-title">${pregunta.pregunta_id || `Pregunta ${index + 1}`}</div>
                <div class="question-score ${statusClass}">${statusIcon} ${statusText}</div>
              </div>
              ${pregunta.puntuacion ? `<p style="margin: 8px 0; font-weight: 600; color: #1e293b;">Puntuación: ${pregunta.puntuacion}/${pregunta.puntuacion_maxima || 'N/A'}</p>` : ''}
              ${pregunta.feedback?.explicacion ? `<div class="question-feedback">${pregunta.feedback.explicacion}</div>` : ''}
            </div>
            `;
          }).join('')}
          ` : ''}

          <div style="margin-top: 30px; padding: 20px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
            <h4 style="color: #1e40af; margin: 0 0 10px 0; font-size: 16px;">💡 Próximos Pasos</h4>
            <p style="color: #1e40af; margin: 0; font-size: 14px;">
              Si tienes dudas sobre tu calificación, no dudes en contactar a tu instructor. 
              ¡Sigue practicando y mejorando!
            </p>
          </div>
        </div>

        <div class="footer">
          <p>Este reporte fue generado automáticamente por el sistema de calificación AI</p>
          <p style="margin-top: 8px; font-size: 12px; opacity: 0.7;">
            ${new Date().toLocaleDateString('es-ES', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}