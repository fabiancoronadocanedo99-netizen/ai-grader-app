'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import Papa from 'papaparse'
import { Resend } from 'resend'

// Inicializar Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// --- Tipos para el CSV ---
type CSVUser = {
  full_name: string
  email: string
  password: string
  role: string
  organization_name: string
}

type BulkImportResult = {
  success: boolean
  createdCount: number
  failedCount: number
  errors: string[]
}

// --- OBTENER PERFIL (LIMPIO) ---
export async function getCurrentUserProfile() {
  const cookieStore = cookies();
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    return null
  }

  return profile
}

// --- FUNCIONES DE GESTIÓN DE USUARIOS ---

export async function createUser(data: {
  email: string
  password: string
  role: string
  organizationId: string
  fullName: string
}) {
  const supabase = createAdminClient()

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  })

  if (authError) {
    return { success: false, error: authError.message }
  }

  if (!authData.user) {
    return { success: false, error: 'No se pudo crear el usuario en Auth' }
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      full_name: data.fullName,
      role: data.role,
      organization_id: data.organizationId,
      onboarding_completed: true
    })

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    return { success: false, error: 'Error de base de datos creando el perfil: ' + profileError.message }
  }

  revalidatePath('/admin/users')
  return { success: true }
}

export async function getUsers() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('*, organizations(name)')
    .order('created_at', { ascending: false })

  if (error) {
    return []
  }

  return data.map(user => {
    // @ts-ignore
    const orgName = user.organizations ? user.organizations.name : 'Sin Asignar';
    return { ...user, organization_name: orgName };
  });
}

export async function updateUser(
  userId: string,
  updates: {
    fullName?: string
    role?: string
    organizationId?: string
  }
) {
  const supabase = createAdminClient()

  try {
    const profileUpdates: any = {}

    if (updates.fullName !== undefined) profileUpdates.full_name = updates.fullName
    if (updates.role !== undefined) profileUpdates.role = updates.role
    if (updates.organizationId !== undefined) profileUpdates.organization_id = updates.organizationId

    const { error } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', userId)

    if (error) throw error

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

export async function deleteUser(userId: string) {
  const supabase = createAdminClient()

  try {
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)
    if (authError) throw authError

    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      console.warn('Advertencia al borrar perfil:', profileError)
    }

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

// --- CREACIÓN MASIVA (CSV) ---

export async function createUsersFromCSV(csvContent: string): Promise<BulkImportResult> {
  let createdCount = 0
  let failedCount = 0
  const errors: string[] = []
  const supabase = createAdminClient()

  try {
    const { data: allOrgs } = await supabase.from('organizations').select('id, name')
    if (!allOrgs) throw new Error("No se pudieron cargar las organizaciones")

    const parseResult = Papa.parse<CSVUser>(csvContent, { header: true, skipEmptyLines: true });
    const users = parseResult.data;

    for (const user of users) {
      try {
        const org = allOrgs.find(o => o.name === user.organization_name)
        if (!org) {
          throw new Error(`Organización '${user.organization_name}' no encontrada.`)
        }

        const result = await createUser({
          email: user.email,
          password: user.password,
          fullName: user.full_name,
          role: user.role,
          organizationId: org.id,
        })

        if (result.success) {
          createdCount++
        } else {
          throw new Error(result.error)
        }
      } catch (error) {
        errors.push(`Fila para ${user.email}: ${(error as Error).message}`)
        failedCount++
      }
    }

    revalidatePath('/admin/users')
    return { success: true, createdCount, failedCount, errors }

  } catch (error) {
    return { 
      success: false, 
      createdCount: 0, 
      failedCount: 0, 
      errors: [(error as Error).message] 
    }
  }
}

// --- ACTUALIZAR LÍMITE (Seguro) ---
export async function updateUserCreditLimit(targetUserId: string, newLimit: number) {
  try {
    const supabaseAuth = createClient();
    const { data: { user: currentUser }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !currentUser) {
      throw new Error('No estás autenticado.')
    }

    const supabaseAdmin = createAdminClient();

    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', currentUser.id)
      .single()

    if (adminProfileError || !adminProfile) {
      throw new Error('No se pudo obtener tu perfil de administrador.')
    }

    if (adminProfile.role !== 'admin') {
      throw new Error('Permisos insuficientes.')
    }

    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', targetUserId)
      .single()

    if (targetProfileError || !targetProfile) {
      throw new Error('Usuario objetivo no encontrado.')
    }

    if (adminProfile.organization_id !== targetProfile.organization_id) {
      throw new Error('Acceso denegado.')
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ monthly_credit_limit: newLimit })
      .eq('id', targetUserId)

    if (updateError) {
      throw updateError
    }

    revalidatePath('/dashboard/admin')
    return { success: true }

  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

// --- ENVIAR REPORTE A PADRES (FODA IA) ---
export async function sendStudentReportToParent(data: {
  studentId: string
  studentName: string
  className: string
  finalGrade: number
  swot: {
    fortalezas: string
    oportunidades: string
    debilidades: string
    amenazas: string
  }
}) {
  const supabase = createAdminClient();

  try {
    // 1. Obtener correos del estudiante y tutor
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('student_email, tutor_email')
      .eq('id', data.studentId)
      .single();

    if (studentError || !student) {
      throw new Error('No se encontró información de contacto para este alumno.');
    }

    const recipients = [student.tutor_email, student.student_email].filter(Boolean) as string[];

    if (recipients.length === 0) {
      throw new Error('El alumno no tiene correos electrónicos registrados.');
    }

    // 2. Construir el diseño del correo (Neumórfico)
    const emailHtml = `
      <div style="background-color: #d1d9e6; padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #444;">
        <div style="max-width: 600px; margin: 0 auto; background: #d1d9e6; border-radius: 40px; padding: 40px; box-shadow: 20px 20px 60px #b1b9c5, -20px -20px 60px #f1f9ff;">

          <!-- Encabezado -->
          <div style="text-align: center; margin-bottom: 40px;">
            <div style="font-size: 50px; margin-bottom: 10px;">🏫</div>
            <h2 style="color: #2b3a4a; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">Reporte de Desempeño</h2>
            <p style="color: #6d7c8d; font-weight: bold; margin-top: 5px;">Clase: ${data.className}</p>
          </div>

          <!-- Perfil del Alumno -->
          <div style="background: #ffffff90; border-radius: 30px; padding: 30px; text-align: center; margin-bottom: 30px; box-shadow: inset 4px 4px 8px #b1b9c5, inset -4px -4px 8px #f1f9ff;">
            <p style="text-transform: uppercase; font-size: 12px; font-weight: 900; color: #888; margin-bottom: 10px; letter-spacing: 1px;">Estudiante</p>
            <h1 style="margin: 0; color: #2b3a4a; font-size: 28px;">${data.studentName}</h1>
            <div style="margin-top: 25px;">
              <p style="margin: 0; font-size: 12px; font-weight: bold; color: #888; text-transform: uppercase;">Calificación Final Proyectada</p>
              <div style="font-size: 64px; font-weight: 900; color: #2563eb;">${data.finalGrade}%</div>
            </div>
          </div>

          <!-- Diagnóstico FODA IA -->
          <div style="margin-bottom: 20px;">
            <h3 style="color: #2b3a4a; font-size: 18px; font-weight: 900; margin-bottom: 20px; text-align: center;">🚀 Diagnóstico Pedagógico IA</h3>

            <div style="margin-bottom: 15px; background: #f0f4f8; padding: 20px; border-radius: 20px; border-left: 8px solid #10b981;">
              <strong style="color: #059669; font-size: 14px; text-transform: uppercase;">💪 Fortalezas</strong>
              <p style="margin: 8px 0 0 0; font-size: 14px; line-height: 1.5; color: #4b5563;">${data.swot.fortalezas}</p>
            </div>

            <div style="margin-bottom: 15px; background: #f0f4f8; padding: 20px; border-radius: 20px; border-left: 8px solid #3b82f6;">
              <strong style="color: #2563eb; font-size: 14px; text-transform: uppercase;">🚀 Oportunidades</strong>
              <p style="margin: 8px 0 0 0; font-size: 14px; line-height: 1.5; color: #4b5563;">${data.swot.oportunidades}</p>
            </div>

            <div style="margin-bottom: 15px; background: #f0f4f8; padding: 20px; border-radius: 20px; border-left: 8px solid #f59e0b;">
              <strong style="color: #d97706; font-size: 14px; text-transform: uppercase;">⚠️ Debilidades</strong>
              <p style="margin: 8px 0 0 0; font-size: 14px; line-height: 1.5; color: #4b5563;">${data.swot.debilidades}</p>
            </div>

            <div style="margin-bottom: 15px; background: #f0f4f8; padding: 20px; border-radius: 20px; border-left: 8px solid #ef4444;">
              <strong style="color: #dc2626; font-size: 14px; text-transform: uppercase;">🚩 Amenazas</strong>
              <p style="margin: 8px 0 0 0; font-size: 14px; line-height: 1.5; color: #4b5563;">${data.swot.amenazas}</p>
            </div>
          </div>

          <!-- Pie de Página -->
          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #b1b9c5;">
            <p style="font-size: 11px; color: #8a99a8; line-height: 1.6;">
              Este es un reporte oficial generado por nuestro sistema de Inteligencia Artificial Pedagógica.<br>
              Para más detalles, por favor contacte a la dirección académica del plantel.
            </p>
          </div>
        </div>
      </div>
    `;

    // 3. Enviar el correo usando Resend
    const { data: mailData, error: mailError } = await resend.emails.send({
      from: 'Sistema Escolar <onboarding@resend.dev>', // Cambia a tu dominio verificado cuando esté listo
      to: recipients,
      subject: `📈 Reporte de Desempeño: ${data.studentName}`,
      html: emailHtml,
    });

    if (mailError) throw mailError;

    return { 
      success: true, 
      message: `Reporte enviado correctamente a ${recipients.length} destinatarios.` 
    };

  } catch (error) {
    console.error('❌ Error enviando reporte:', error);
    return { success: false, error: (error as Error).message };
  }
}