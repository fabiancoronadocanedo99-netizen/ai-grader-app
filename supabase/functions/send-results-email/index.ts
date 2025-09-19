// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

console.log("Send Results Email Function started")

Deno.serve(async (req: Request) => {
  try {
    // Parse request body
    const { gradeId } = await req.json()
    
    if (!gradeId) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required field: gradeId' 
        }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" } 
        }
      )
    }

    // Validate gradeId is a positive integer
    const parsedGradeId = parseInt(gradeId)
    if (isNaN(parsedGradeId) || parsedGradeId <= 0) {
      return new Response(
        JSON.stringify({ 
          error: 'gradeId must be a valid positive integer' 
        }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" } 
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

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required' 
        }),
        { 
          status: 401,
          headers: { "Content-Type": "application/json" } 
        }
      )
    }

    // Get complete grade data with student and class information using RLS
    // This will only return data if the authenticated user owns the class
    const { data: gradeData, error: gradeError } = await supabase
      .from('grades')
      .select(`
        *,
        students (
          id,
          full_name,
          student_email,
          tutor_email,
          class_id,
          classes (
            id,
            user_id
          )
        )
      `)
      .eq('id', parsedGradeId)
      .single()

    if (gradeError || !gradeData) {
      return new Response(
        JSON.stringify({ 
          error: 'Grade not found or access denied' 
        }),
        { 
          status: 404,
          headers: { "Content-Type": "application/json" } 
        }
      )
    }

    // Verify student data exists
    const studentData = gradeData.students
    if (!studentData) {
      return new Response(
        JSON.stringify({ 
          error: 'Student data not found for this grade' 
        }),
        { 
          status: 404,
          headers: { "Content-Type": "application/json" } 
        }
      )
    }


    // Parse AI feedback
    let aiReport = gradeData.ai_feedback
    if (typeof aiReport === 'string') {
      try {
        aiReport = JSON.parse(aiReport)
      } catch (e) {
        console.warn('Could not parse AI feedback JSON:', e)
        aiReport = {}
      }
    }

    const feedbackData = aiReport?.informe_evaluacion || aiReport || {}
    const resumen = feedbackData?.resumen_general || {}
    const evaluaciones = feedbackData?.evaluacion_detallada || []

    // Build professional HTML email template
    const emailHTML = buildEmailTemplate({
      studentName: studentData.full_name,
      grade: gradeData.grade,
      maxGrade: gradeData.max_grade || 100,
      feedback: feedbackData,
      resumen: resumen,
      evaluaciones: evaluaciones
    })

    // Get Resend API key and from address
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Resend API key not configured' 
        }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" } 
        }
      )
    }

    const fromAddress = Deno.env.get('EMAIL_FROM_ADDRESS') || 'AI Grader <onboarding@resend.dev>'

    // Prepare email recipients
    const recipients = []
    if (studentData.student_email) recipients.push(studentData.student_email)
    if (studentData.tutor_email) recipients.push(studentData.tutor_email)

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No email addresses found for student or tutor' 
        }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" } 
        }
      )
    }

    // Send email using Resend API
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: fromAddress,
        to: recipients,
        subject: `📊 Reporte de Calificación - ${studentData.full_name}`,
        html: emailHTML,
        text: `Reporte de Calificación para ${studentData.full_name}\n\nCalificación: ${gradeData.grade}/${gradeData.max_grade || 100}\n\nRevisa tu correo para ver el reporte completo.`
      })
    })

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json()
      console.error('Resend API Error:', errorData)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send email',
          details: errorData
        }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" } 
        }
      )
    }

    const emailData = await emailResponse.json()
    console.log('Email sent successfully:', emailData)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Report sent successfully',
        emailId: emailData.id,
        sentTo: recipients
      }),
      { 
        status: 200,
        headers: { "Content-Type": "application/json" } 
      }
    )

  } catch (error) {
    console.error('Error in send-results-email function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error while sending email' 
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" } 
      }
    )
  }
})

// Function to build professional HTML email template
function buildEmailTemplate({ studentName, grade, maxGrade, feedback, resumen, evaluaciones }: {
  studentName: string;
  grade: number;
  maxGrade: number;
  feedback: any;
  resumen: any;
  evaluaciones: any[];
}) {
  const percentage = Math.round((grade / maxGrade) * 100)
  const gradeColor = percentage >= 80 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444'

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
  `
}

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/send-results-email' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"gradeId": "123"}'

*/