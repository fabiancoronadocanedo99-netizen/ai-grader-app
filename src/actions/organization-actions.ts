'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// --- 1. Obtener detalles de una organización y sus usuarios ---
export async function getOrganizationDetails(id: string) {
  const supabase = createAdminClient()

  try {
    // Obtener datos de la organización
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single()

    if (orgError) throw orgError

    // Obtener perfiles asociados a esta organización
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', id)

    if (usersError) throw usersError

    return { organization, users }
  } catch (error) {
    console.error('Error en getOrganizationDetails:', error)
    return { organization: null, users: [], error: (error as Error).message }
  }
}

// --- 2. Actualizar detalles genéricos de la organización ---
// (Refactorizada para ser más flexible y revalidar la ruta específica)
export async function updateOrganizationDetails(id: string, updates: any) {
  const supabase = createAdminClient()

  try {
    const { error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', id)

    if (error) throw error

    revalidatePath(`/admin/organizations/${id}`)
    revalidatePath('/admin/organizations')
    return { success: true }
  } catch (error) {
    console.error('Error en updateOrganizationDetails:', error)
    return { success: false, error: (error as Error).message }
  }
}

// --- 3. Asignar Plan a la Organización ---
export async function assignPlanToOrganization(
  organizationId: string, 
  plan: 'Basic' | 'Pro' | 'Enterprise'
) {
  const supabase = createAdminClient()

  // Definir límites de créditos según el plan
  const planConfig = {
    Basic: 15000,
    Pro: 30000,
    Enterprise: 99999
  }

  const credits = planConfig[plan]

  // Calcular fecha de renovación (hoy + 1 mes)
  const nextRenewalDate = new Date()
  nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1)

  try {
    const { error } = await supabase
      .from('organizations')
      .update({
        subscription_plan: plan,
        credits_per_period: credits,
        credits_remaining: credits,
        next_renewal_date: nextRenewalDate.toISOString(),
      })
      .eq('id', organizationId)

    if (error) throw error

    revalidatePath(`/admin/organizations/${organizationId}`)
    return { success: true }
  } catch (error) {
    console.error('Error en assignPlanToOrganization:', error)
    return { success: false, error: (error as Error).message }
  }
}

// --- 4. Generar y enviar pre-factura por email ---
export async function generatePreInvoice(organizationId: string) {
  const supabase = createAdminClient()

  try {
    // 1. Obtener datos necesarios
    const { data: org, error: fetchError } = await supabase
      .from('organizations')
      .select('name, subscription_plan, finance_contact_email, billing_address, tax_id, credits_per_period')
      .eq('id', organizationId)
      .single()

    if (fetchError || !org) throw new Error('No se encontró la organización o sus datos de facturación')
    if (!org.finance_contact_email) throw new Error('La organización no tiene un email de contacto financiero configurado.')

    // 2. Construir el HTML del Email
    const emailHtml = `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Pre-Factura de Servicio</h2>
        <p>Hola <strong>${org.name}</strong>,</p>
        <p>Este es un borrador de los detalles de cobro para el próximo periodo:</p>
        <hr />
        <p><strong>Plan:</strong> ${org.subscription_plan}</p>
        <p><strong>Créditos incluidos:</strong> ${org.credits_per_period}</p>
        <p><strong>ID Fiscal:</strong> ${org.tax_id || 'No especificado'}</p>
        <p><strong>Dirección:</strong> ${org.billing_address || 'No especificada'}</p>
        <hr />
        <p>Este documento no es una factura legal, es solo una notificación previa al cargo automático.</p>
        <p>Saludos,<br/>El equipo administrativo</p>
      </div>
    `

    // 3. Enviar email con Resend
    const { data, error: sendError } = await resend.emails.send({
      from: 'Admin <noreply@tudominio.com>', // Asegúrate de configurar este dominio en Resend
      to: [org.finance_contact_email],
      subject: `Pre-Factura: ${org.name} - Plan ${org.subscription_plan}`,
      html: emailHtml,
    })

    if (sendError) throw sendError

    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Error en generatePreInvoice:', error)
    return { success: false, error: (error as Error).message }
  }
}

// --- Acciones de legado (mantenidas por compatibilidad) ---

export async function createOrganization(name: string) {
  const supabase = createAdminClient()
  try {
    const { error } = await supabase.from('organizations').insert([{ name }])
    if (error) throw error
    revalidatePath('/admin/organizations')
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

export async function getOrganizations() {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('organizations').select('*').order('name')
  if (error) return []
  return data
}

export async function deleteOrganization(id: string) {
  const supabase = createAdminClient()
  try {
    const { error } = await supabase.from('organizations').delete().eq('id', id)
    if (error) throw error
    revalidatePath('/admin/organizations')
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}