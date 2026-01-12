// src/app/api/get-student-dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.replace('Bearer ', '')
    if (!accessToken) return NextResponse.json({ error: 'Token requerido' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // 2. Obtener datos del estudiante
    const { studentId } = await request.json()
    const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data: studentData, error: studentError } = await supabaseAdmin
      .from('students')
      .select(`
        *,
        classes ( name, user_id ),
        grades ( 
          id, score_obtained, score_possible, ai_feedback, created_at,
          exams ( name, type )
        )
      `)
      .eq('id', studentId)
      .single()

    if (studentError || !studentData) return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 })

    // Verificación de seguridad: El usuario debe ser dueño de la clase
    if (studentData.classes.user_id !== user.id) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    // --- 3. LÓGICA DE GENERACIÓN FODA IA (CACHÉ 15 DÍAS) ---
    let finalSwot = studentData.ai_swot
    const lastUpdate = studentData.swot_last_updated ? new Date(studentData.swot_last_updated) : null
    const daysSince = lastUpdate ? (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24) : 999

    // Generar si es nulo o si ya pasaron los 15 días
    if (!finalSwot || daysSince > 15) {
      console.log("🤖 Generando nuevo diagnóstico FODA para:", studentData.full_name);

      // Extraemos los feedbacks de tus informes JSONB complejos
      const feedbackTexts = studentData.grades
        .filter((g: any) => g.ai_feedback)
        .slice(0, 10) 
        .map((g: any) => {
          const f = g.ai_feedback;
          const examName = g.exams?.name || 'Evaluación';
          // Convertimos el objeto JSONB a texto para la IA
          return `Examen: ${examName}. Análisis: ${JSON.stringify(f)}`;
        });

      if (feedbackTexts.length > 0) {
        const swotResult = await generateSWOT(feedbackTexts);

        if (swotResult) {
          finalSwot = swotResult;
          // Guardar en la base de datos para los próximos 15 días
          await supabaseAdmin.from('students')
            .update({ 
              ai_swot: finalSwot, 
              swot_last_updated: new Date().toISOString() 
            })
            .eq('id', studentId);
        }
      }
    }

    // Fallback si la IA falla o no hay suficientes datos
    if (!finalSwot) {
      finalSwot = {
        fortalezas: "Análisis en proceso. Se requiere completar más evaluaciones.",
        oportunidades: "El historial pedagógico se está nutriendo para este diagnóstico.",
        debilidades: "Datos insuficientes por el momento para un diagnóstico preciso.",
        amenazas: "Mantener la regularidad en las entregas para evitar falta de información."
      };
    }

    // 4. Devolver respuesta estructurada
    return NextResponse.json({
      success: true,
      student: {
        id: studentData.id,
        fullName: studentData.full_name,
        studentEmail: studentData.student_email,
        tutorEmail: studentData.tutor_email,
      },
      class: { name: studentData.classes.name },
      grades: studentData.grades.map((g: any) => ({
        id: g.id,
        examName: g.exams?.name || 'Evaluación',
        type: g.exams?.type || 'exam',
        scoreObtained: g.score_obtained,
        scorePossible: g.score_possible,
        percentage: g.score_possible ? Math.round((g.score_obtained / g.score_possible) * 100) : 0,
        createdAt: g.created_at
      })),
      stats: {
        totalEvaluations: studentData.grades.length,
        averageScore: calculateAverage(studentData.grades),
        totalPoints: calculatePoints(studentData.grades),
        monthlyAverages: calculateMonthly(studentData.grades)
      },
      ai_swot: finalSwot
    })

  } catch (error) {
    console.error("❌ Error en API Dashboard:", error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// --- FUNCIÓN GEMINI CORREGIDA CON TU LLAVE EXACTA ---
async function generateSWOT(feedbacks: string[]) {
  try {
    // Usamos el nombre exacto que confirmamos en tus archivos: GOOGLE_AI_API_KEY
    const GEMINI_KEY = process.env.GOOGLE_AI_API_KEY;

    if (!GEMINI_KEY) {
      console.error("❌ ERROR: No se encontró GOOGLE_AI_API_KEY en variables de entorno.");
      return null;
    }

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Eres un experto pedagogo. Analiza estos informes de un alumno: 
            ${feedbacks.join('\n')}
            Genera un análisis FODA real, ejecutivo y motivador.
            Responde ÚNICAMENTE un objeto JSON con las claves: fortalezas, oportunidades, debilidades, amenazas.
            No escribas nada más que el JSON puro.`
          }]
        }]
      })
    });

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Limpieza de JSON: Buscamos el objeto real entre las llaves { }
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start === -1 || end === -1) return null;

    const jsonString = rawText.substring(start, end + 1);
    const parsed = JSON.parse(jsonString);

    // Normalizar llaves a minúsculas
    const normalized: any = {};
    Object.keys(parsed).forEach(key => {
      normalized[key.toLowerCase()] = parsed[key];
    });

    return normalized;
  } catch (e) {
    console.error("❌ Error procesando respuesta de Gemini:", e);
    return null;
  }
}

// --- FUNCIONES AUXILIARES ---

function calculateAverage(grades: any[]) {
  const v = grades.filter(g => g.score_obtained !== null && g.score_possible);
  if (v.length === 0) return 0;
  return Math.round(v.reduce((s, g) => s + ((g.score_obtained / g.score_possible) * 100), 0) / v.length);
}

function calculatePoints(grades: any[]) {
  return {
    obtained: grades.reduce((s, g) => s + (g.score_obtained || 0), 0),
    possible: grades.reduce((s, g) => s + (g.score_possible || 0), 0)
  }
}

function calculateMonthly(grades: any[]) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const stats = Array.from({ length: 12 }, (_, i) => ({ month: months[i], sum: 0, count: 0 }));
  const currentYear = new Date().getFullYear();

  grades.forEach(g => {
    const d = new Date(g.created_at);
    if (d.getFullYear() === currentYear && g.score_possible) {
      const idx = d.getMonth();
      stats[idx].sum += (g.score_obtained / g.score_possible) * 100;
      stats[idx].count++;
    }
  });
  return stats.map(m => ({ month: m.month, average: m.count > 0 ? Math.round(m.sum / m.count) : null }));
}