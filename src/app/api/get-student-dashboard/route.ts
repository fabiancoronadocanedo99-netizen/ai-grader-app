// src/app/api/get-student-dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.replace('Bearer ', '')
    if (!accessToken) return NextResponse.json({ error: 'No token' }, { status: 401 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { studentId } = await request.json()
    const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data: studentData, error: studentError } = await supabaseAdmin
      .from('students')
      .select(`*, classes ( name, user_id ), grades ( id, score_obtained, score_possible, ai_feedback, created_at, exams ( name, type ) )`)
      .eq('id', studentId)
      .single()

    if (studentError || !studentData) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // --- LÓGICA FODA MEJORADA ---
    let finalSwot = studentData.ai_swot

    if (!finalSwot) {
      console.log("🤖 Intentando generar FODA real para:", studentData.full_name);

      // Buscamos comentarios reales en los exámenes
      const validGrades = (studentData.grades || []).filter((g: any) => g.ai_feedback);

      // Extraemos un resumen de los últimos 3 exámenes para darle contexto a la IA
      const context = validGrades.slice(0, 3).map((g: any) => {
          const feedback = g.ai_feedback?.informe_evaluacion?.resumen_general?.comentarios_globales 
                        || JSON.stringify(g.ai_feedback);
          return `Examen ${g.exams?.name}: ${feedback}`;
      }).join(" | ");

      const generated = await generateSWOT(context.substring(0, 1000));

      if (generated) {
        finalSwot = generated;
        // Guardamos inmediatamente en la base de datos
        await supabaseAdmin
          .from('students')
          .update({ 
            ai_swot: generated, 
            swot_last_updated: new Date().toISOString() 
          })
          .eq('id', studentId);
        console.log("✅ FODA generado y guardado en DB");
      }
    }

    // Respuesta final sincronizada con el frontend
    return NextResponse.json({
      success: true,
      student: { id: studentData.id, fullName: studentData.full_name, studentEmail: studentData.student_email, tutorEmail: studentData.tutor_email },
      class: { name: studentData.classes?.name || 'Sin clase' },
      grades: (studentData.grades || []).map((g: any) => ({
        id: g.id, examName: g.exams?.name || 'Evaluación', type: g.exams?.type || 'exam',
        scoreObtained: g.score_obtained, scorePossible: g.score_possible,
        percentage: g.score_possible ? Math.round((g.score_obtained / g.score_possible) * 100) : 0,
        createdAt: g.created_at
      })),
      stats: {
        totalEvaluations: studentData.grades?.length || 0,
        totalPoints: {
            obtained: (studentData.grades || []).reduce((acc: number, curr: any) => acc + (curr.score_obtained || 0), 0),
            possible: (studentData.grades || []).reduce((acc: number, curr: any) => acc + (curr.score_possible || 0), 0)
        },
        monthlyAverages: calculateMonthly(studentData.grades || [])
      },
      ai_swot: finalSwot || { fortalezas: "Análisis en curso...", oportunidades: "Análisis en curso...", debilidades: "Análisis en curso...", amenazas: "Análisis en curso..." }
    })
  } catch (e) { 
    console.error("Error crítico API:", e);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}

// --- FUNCIÓN DE IA BLINDADA ---
async function generateSWOT(ctx: string) {
  try {
    const key = process.env.GOOGLE_AI_API_KEY;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents: [{ 
          parts: [{ 
            text: `Analiza el desempeño de este alumno y genera un FODA ejecutivo (máximo 2 frases por punto). 
            Contexto: ${ctx}

            Responde ÚNICAMENTE un objeto JSON con esta estructura exacta:
            {"fortalezas": "...", "oportunidades": "...", "debilidades": "...", "amenazas": "..."}` 
          }] 
        }],
        generationConfig: { temperature: 0.2 }
      })
    });

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // LIMPIEZA EXTREMA: Buscamos donde empieza el { y donde termina el }
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start === -1 || end === -1) return null;

    const jsonString = rawText.substring(start, end + 1);
    const parsed = JSON.parse(jsonString);

    // Normalizar llaves a minúsculas
    const normalized: any = {};
    Object.keys(parsed).forEach(k => normalized[k.toLowerCase()] = parsed[k]);
    return normalized;
  } catch (err) {
    console.error("Fallo generateSWOT:", err);
    return null;
  }
}

function calculateMonthly(gs: any[]) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const stats = Array.from({ length: 12 }, (_, i) => ({ month: months[i], sum: 0, count: 0 }));
  const year = new Date().getFullYear();
  gs.forEach(g => {
    const d = new Date(g.created_at);
    if (d.getFullYear() === year && g.score_possible) {
      const idx = d.getMonth(); stats[idx].sum += (g.score_obtained / g.score_possible) * 100; stats[idx].count++;
    }
  });
  return stats.map(m => ({ month: m.month, average: m.count > 0 ? Math.round(m.sum / m.count) : null }));
}