'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import Papa from 'papaparse'
import { Resend } from 'resend'
import { logEvent } from './audit-actions'

// Inicializar Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// --- Tipos para el CSV ---
// NOTA: password ya no es obligatorio en el CSV de entrada
type CSVUser = {
  full_name: string
  email: string
  password?: string 
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

// --- NUEVA FUNCIÓN: Enviar correo de bienvenida ---
export async function sendWelcomeEmail(email: string, fullName: string, password: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Onboarding Pixelgo <onboarding@pixelgo.com.mx>',
      to: [email],
      subject: '¡Bienvenido a AI Grader de Pixelgo!',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h1 style="color: #2563eb;">Bienvenido a Pixelgo AI</h1>
          <p>Hola <strong>${fullName}</strong>,</p>
          <p>Tu cuenta ha sido creada exitosamente. A continuación encontrarás tus credenciales de acceso:</p>

          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Usuario:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>Contraseña Temporal:</strong> ${password}</p>
          </div>

          <p>Puedes iniciar sesión ahora en nuestra plataforma:</p>
          <a href="https://aigrader.pixelgo.com.mx" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Ir a la Plataforma
          </a>

          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            Por seguridad, te recomendamos cambiar tu contraseña al ingresar por primera vez.
          </p>
        </div>
      `
    });

    if (error) {
      console.error('Error enviando email de bienvenida:', error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (e) {
    console.error('Excepción enviando email:', e);
    return { success: false, error: e };
  }
}

// --- FUNCIONES GESTIÓN DE USUARIOS ---

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

  // Esperamos un momento para que el trigger de la DB cree el perfil base
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Ahora actualizamos ese perfil con los datos correctos (Rol y Organización)
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: data.fullName,
      role: data.role,
      organization_id: data.organizationId,
      onboarding_completed: true
    })
    .eq('id', authData.user.id); // Buscamos al usuario que acabamos de crear

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    return { success: false, error: 'Error actualizando el perfil: ' + profileError.message }
  }

  // Registro de auditoría
  await logEvent('CREATE_USER', 'profile', authData.user.id, { 
    email: data.email, 
    role: data.role 
  })

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

    // Registro de auditoría
    await logEvent('UPDATE_USER', 'profile', userId, updates)

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

export async function deleteUser(userId: string) {
  const supabase = createAdminClient()

  try {
    // Registro de auditoría antes de borrar
    await logEvent('DELETE_USER', 'profile', userId, { 
      note: 'Usuario eliminado del sistema' 
    })

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

        // 1. Generar contraseña aleatoria de 10 caracteres
        const generatedPassword = Math.random().toString(36).slice(-10);

        // 2. Crear usuario
        const result = await createUser({
          email: user.email,
          password: generatedPassword, // Usamos la generada
          fullName: user.full_name,
          role: user.role,
          organizationId: org.id,
        })

        if (result.success) {
          createdCount++

          // 3. Enviar correo de bienvenida con credenciales
          // No esperamos (await) obligatoriamente para no bloquear el loop masivo,
          // pero logueamos si falla.
          sendWelcomeEmail(user.email, user.full_name, generatedPassword);

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

// --- ENVIAR REPORTE A PADRES (DOMINIO PIXELGO VERIFICADO) ---
export async function sendStudentReportToParent(data: {
  studentId: string
  studentName: string
  className: string
  finalGrade: number
  swot: any
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
      throw new Error('Información del alumno no encontrada en la base de datos.');
    }

    const recipients = [student.tutor_email, student.student_email].filter(Boolean) as string[];

    if (recipients.length === 0) {
      throw new Error('El alumno no tiene correos electrónicos registrados para recibir el reporte.');
    }

    // 2. Construir diseño de correo profesional
    const emailHtml = `
      <div style="background-color: #d1d9e6; padding: 40px; font-family: sans-serif; color: #444;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 40px; padding: 40px; box-shadow: 0 15px 35px rgba(0,0,0,0.1);">

          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">Reporte Académico Pixelgo</h1>
            <p style="color: #666; font-size: 14px;">Diagnóstico de desempeño mediante Inteligencia Artificial</p>
          </div>

          <div style="background: #f8fafc; border-radius: 25px; padding: 30px; text-align: center; margin-bottom: 30px; border: 1px solid #e2e8f0;">
            <p style="text-transform: uppercase; font-size: 11px; font-weight: 900; color: #94a3b8; margin-bottom: 5px;">Estudiante</p>
            <h2 style="margin: 0; color: #1e293b; font-size: 26px;">${data.studentName}</h2>
            <p style="margin: 5px 0 0 0; color: #64748b; font-weight: bold;">Clase: ${data.className}</p>

            <div style="margin-top: 25px;">
              <span style="font-size: 12px; font-weight: 800; color: #3b82f6; text-transform: uppercase;">Promedio General Proyectado</span>
              <div style="font-size: 56px; font-weight: 900; color: #2563eb;">${data.finalGrade}%</div>
            </div>
          </div>

          <h3 style="color: #1e293b; font-size: 18px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 20px;">🚀 Análisis FODA Académico</h3>

          <div style="margin-bottom: 15px;">
            <div style="background: #ecfdf5; padding: 15px; border-radius: 15px; border-left: 6px solid #10b981; margin-bottom: 10px;">
              <strong style="color: #059669; font-size: 13px; text-transform: uppercase;">💪 Fortalezas</strong>
              <p style="margin: 5px 0 0 0; font-size: 14px; line-height: 1.5; color: #064e3b;">${data.swot?.fortalezas || 'Pendiente de análisis'}</p>
            </div>

            <div style="background: #eff6ff; padding: 15px; border-radius: 15px; border-left: 6px solid #3b82f6; margin-bottom: 10px;">
              <strong style="color: #2563eb; font-size: 13px; text-transform: uppercase;">🚀 Oportunidades</strong>
              <p style="margin: 5px 0 0 0; font-size: 14px; line-height: 1.5; color: #1e3a8a;">${data.swot?.oportunidades || 'Pendiente de análisis'}</p>
            </div>

            <div style="background: #fffbeb; padding: 15px; border-radius: 15px; border-left: 6px solid #f59e0b; margin-bottom: 10px;">
              <strong style="color: #d97706; font-size: 13px; text-transform: uppercase;">⚠️ Debilidades</strong>
              <p style="margin: 5px 0 0 0; font-size: 14px; line-height: 1.5; color: #78350f;">${data.swot?.debilidades || 'Pendiente de análisis'}</p>
            </div>

            <div style="background: #fef2f2; padding: 15px; border-radius: 15px; border-left: 6px solid #ef4444;">
              <strong style="color: #dc2626; font-size: 13px; text-transform: uppercase;">🚩 Amenazas</strong>
              <p style="margin: 5px 0 0 0; font-size: 14px; line-height: 1.5; color: #7f1d1d;">${data.swot?.amenazas || 'Pendiente de análisis'}</p>
            </div>
          </div>

          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
            <p style="font-size: 11px; color: #94a3b8; line-height: 1.6;">
              Este reporte ha sido generado automáticamente por la plataforma Pixelgo AI.<br>
              Para más información, consulte con el asesor académico.
            </p>
          </div>
        </div>
      </div>
    `;

    // 3. Enviar correo usando el dominio verificado
    const { data: resData, error: resError } = await resend.emails.send({
      from: 'Reportes Académicos <reportes@pixelgo.com.mx>', 
      to: recipients,
      subject: `📈 Reporte de Desempeño: ${data.studentName}`,
      html: emailHtml,
    });

    if (resError) {
      console.error('Resend Error:', resError);
      throw new Error(resError.message);
    }

    return { success: true, message: 'Reporte enviado con éxito.' };

  } catch (error) {
    console.error('Error en sendStudentReportToParent:', error);
    return { success: false, error: (error as Error).message };
  }
}