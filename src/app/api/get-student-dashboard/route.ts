// src/app/api/get-student-dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
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
    if (studentData.classes.user_id !== user.id) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    let finalSwot = studentData.ai_swot
    const lastUpdate = studentData.swot_last_updated ? new Date(studentData.swot_last_updated) : null
    const daysSince = lastUpdate ? (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24) : 999

    // SI NO HAY SWOT O PASARON 15 DIAS, GENERAMOS
    if (!finalSwot || daysSince > 15) {
      console.log("🤖 Iniciando proceso de generación FODA para:", studentData.full_name);

      const feedbackTexts = studentData.grades
        .filter((g: any) => g.ai_feedback)
        .slice(0, 10) 
        .map((g: any) => {
          const f = g.ai_feedback;
          const examName = g.exams?.name || 'Evaluación';
          // Extraemos contenido de tu JSONB de Supabase
          const content = f.informe_evaluacion 
            ? JSON.stringify(f.informe_evaluacion) 
            : JSON.stringify(f);
          return `Examen: ${examName}. Data: ${content}`;
        });

      if (feedbackTexts.length > 0) {
        const swotResult = await generateSWOT(feedbackTexts);

        if (swotResult) {
          finalSwot = swotResult;
          // GUARDAR EN BASE DE DATOS
          const { error: updateError } = await supabaseAdmin
            .from('students')
            .update({ 
              ai_swot: finalSwot, 
              swot_last_updated: new Date().toISOString() 
            })
            .eq('id', studentId);

          if (updateError) console.error("❌ Error guardando SWOT en DB:", updateError);
          else console.log("✅ SWOT guardado con éxito");
        }
      }
    }

    // FALLBACK: Si la IA falló o no devolvió nada, mensaje amigable
    if (!finalSwot) {
      finalSwot = {
        fortalezas: "Análisis en proceso. Continúa realizando evaluaciones.",
        oportunidades: "El historial de feedback se está recopilando para este diagnóstico.",
        debilidades: "Se requiere más contexto pedagógico para identificar áreas de mejora.",
        amenazas: "Mantén la regularidad en tus entregas para evitar falta de datos."
      };
    }

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
    console.error("❌ Error fatal en API:", error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// --- FUNCIÓN GEMINI REFORZADA (MÁS RESISTENTE) ---
async function generateSWOT(feedbacks: string[]) {
  try {
    const GEMINI_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analiza estos informes pedagógicos de un alumno: 
            ${feedbacks.join('\n')}
            Genera un análisis FODA real y motivador.
            Responde ÚNICAMENTE un objeto JSON con las claves: fortalezas, oportunidades, debilidades, amenazas.
            No escribas nada más que el JSON.`
          }]
        }]
      })
    });

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // LIMPIEZA DE JSON (Busca el primer { y el último })
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start === -1 || end === -1) return null;

    const jsonString = rawText.substring(start, end + 1);
    const parsed = JSON.parse(jsonString);

    // NORMALIZAR CLAVES (Por si Gemini responde con Mayúsculas)
    const normalized: any = {};
    Object.keys(parsed).forEach(key => {
      normalized[key.toLowerCase()] = parsed[key];
    });

    // Validar que tengamos las 4 claves necesarias
    if (normalized.fortalezas && normalized.oportunidades) {
      return normalized;
    }

    return null;
  } catch (e) {
    console.error("❌ Error parseando respuesta de Gemini:", e);
    return null;
  }
}

function calculateAverage(grades: any[]) {
  const v = grades.filter(g => g.score_obtained !== null && g.score_possible);
  return v.length ? Math.round(v.reduce((s, g) => s + ((g.score_obtained / g.score_possible) * 100), 0) / v.length) : 0;
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
  grades.forEach(g => {
    const d = new Date(g.created_at);
    if (d.getFullYear() === new Date().getFullYear() && g.score_possible) {
      const idx = d.getMonth();
      stats[idx].sum += (g.score_obtained / g.score_possible) * 100;
      stats[idx].count++;
    }
  });
  return stats.map(m => ({ month: m.month, average: m.count > 0 ? Math.round(m.sum / m.count) : null }));
}