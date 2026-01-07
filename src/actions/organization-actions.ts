'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// --- ESTADÍSTICAS GENERALES DEL ADMIN (sin RLS) ---
export async function getAdminStats() {
  const supabase = createAdminClient()

  try {
    // Total de organizaciones
    const { count: orgCount, error: orgError } = await supabase
      .from('organizations')
      .select('*', { count: 'exact', head: true })

    if (orgError) throw orgError

    // Total de usuarios
    const { count: userCount, error: userError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    if (userError) throw userError

    // Total de créditos asignados (suma de credits_per_period)
    const { data: creditsData, error: creditsError } = await supabase
      .from('organizations')
      .select('credits_per_period, credits_remaining')

    if (creditsError) throw creditsError

    const totalCreditsAssigned = creditsData?.reduce((sum, org) => sum + (org.credits_per_period || 0), 0) || 0
    const totalCreditsRemaining = creditsData?.reduce((sum, org) => sum + (org.credits_remaining || 0), 0) || 0

    // Organizaciones por plan
    const { data: planData, error: planError } = await supabase
      .from('organizations')
      .select('subscription_plan')

    if (planError) throw planError

    const planDistribution = planData?.reduce((acc: Record<string, number>, org) => {
      const plan = org.subscription_plan || 'Sin Plan'
      acc[plan] = (acc[plan] || 0) + 1
      return acc
    }, {})

    return {
      totalOrganizations: orgCount || 0,
      totalUsers: userCount || 0,
      totalCreditsAssigned,
      totalCreditsRemaining,
      planDistribution: planDistribution || {},
      error: null
    }
  } catch (error) {
    console.error('Error en getAdminStats:', error)
    return {
      totalOrganizations: 0,
      totalUsers: 0,
      totalCreditsAssigned: 0,
      totalCreditsRemaining: 0,
      planDistribution: {},
      error: (error as Error).message
    }
  }
}

// --- OBTENER TODAS LAS ORGANIZACIONES CON DETALLES (sin RLS) ---
export async function getAllOrganizationsWithDetails() {
  const supabase = createAdminClient()

  try {
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select(`
        *,
        profiles:profiles(count)
      `)
      .order('created_at', { ascending: false })

    if (orgError) throw orgError

    return { organizations: organizations || [], error: null }
  } catch (error) {
    console.error('Error en getAllOrganizationsWithDetails:', error)
    return { organizations: [], error: (error as Error).message }
  }
}

// --- OBTENER DETALLES DE UNA ORGANIZACIÓN (sin RLS) ---
export async function getOrganizationDetails(id: string) {
  const supabase = createAdminClient()

  try {
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single()

    if (orgError) throw orgError

    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', id)
      .order('created_at', { ascending: false })

    if (usersError) throw usersError

    return { organization, users: users || [], error: null }
  } catch (error) {
    console.error('Error en getOrganizationDetails:', error)
    return { organization: null, users: [], error: (error as Error).message }
  }
}

// --- OBTENER TODOS LOS USUARIOS (sin RLS) ---
export async function getAllUsers() {
  const supabase = createAdminClient()

  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select(`
        *,
        organizations:organizations(name)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    return { users: users || [], error: null }
  } catch (error) {
    console.error('Error en getAllUsers:', error)
    return { users: [], error: (error as Error).message }
  }
}

// --- ACTUALIZAR DETALLES DE ORGANIZACIÓN ---
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
    return { success: true, error: null }
  } catch (error) {
    console.error('Error en updateOrganizationDetails:', error)
    return { success: false, error: (error as Error).message }
  }
}

// --- SUBIR LOGO DE ORGANIZACIÓN ---
export async function uploadOrganizationLogo(organizationId: string, formData: FormData) {
  const supabase = createAdminClient()
  const file = formData.get('logo') as File

  if (!file) {
    return { success: false, error: 'No se ha seleccionado ningún archivo.' }
  }

  try {
    const fileExtension = file.name.split('.').pop()
    const fileName = `logo_${organizationId}_${Date.now()}.${fileExtension}`
    const filePath = `${organizationId}/${fileName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('organization_logos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('organization_logos')
      .getPublicUrl(filePath)

    const { error: updateError } = await supabase
      .from('organizations')
      .update({ logo_url: publicUrl })
      .eq('id', organizationId)

    if (updateError) throw updateError

    revalidatePath(`/admin/organizations/${organizationId}`)
    revalidatePath('/admin/organizations')

    return { success: true, publicUrl, error: null }
  } catch (error) {
    console.error('Error en uploadOrganizationLogo:', error)
    return { success: false, error: (error as Error).message }
  }
}

// --- ASIGNAR PLAN A LA ORGANIZACIÓN ---
export async function assignPlanToOrganization(
  organizationId: string, 
  plan: 'Basic' | 'Pro' | 'Enterprise'
) {
  const supabase = createAdminClient()

  const planConfig = {
    Basic: 15000,
    Pro: 30000,
    Enterprise: 99999
  }

  const credits = planConfig[plan]
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
    revalidatePath('/admin/organizations')
    return { success: true, error: null }
  } catch (error) {
    console.error('Error en assignPlanToOrganization:', error)
    return { success: false, error: (error as Error).message }
  }
}

// --- GENERAR Y ENVIAR PRE-FACTURA ---
export async function generatePreInvoice(organizationId: string) {
  const supabase = createAdminClient()

  try {
    const { data: org, error: fetchError } = await supabase
      .from('organizations')
      .select('name, subscription_plan, finance_contact_email, billing_address, tax_id, credits_per_period')
      .eq('id', organizationId)
      .single()

    if (fetchError || !org) throw new Error('No se encontró la organización')
    if (!org.finance_contact_email) throw new Error('Sin email de contacto financiero')

    const emailHtml = `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Pre-Factura de Servicio</h2>
        <p>Hola <strong>${org.name}</strong>,</p>
        <p>Detalles del próximo periodo:</p>
        <hr />
        <p><strong>Plan:</strong> ${org.subscription_plan}</p>
        <p><strong>Créditos:</strong> ${org.credits_per_period}</p>
        <p><strong>ID Fiscal:</strong> ${org.tax_id || 'No especificado'}</p>
        <p><strong>Dirección:</strong> ${org.billing_address || 'No especificada'}</p>
        <hr />
        <p>Documento informativo, no es factura legal.</p>
        <p>Saludos,<br/>Equipo Administrativo</p>
      </div>
    `

    const { data, error: sendError } = await resend.emails.send({
      from: 'Admin <noreply@tudominio.com>',
      to: [org.finance_contact_email],
      subject: `Pre-Factura: ${org.name} - Plan ${org.subscription_plan}`,
      html: emailHtml,
    })

    if (sendError) throw sendError

    return { success: true, messageId: data?.id, error: null }
  } catch (error) {
    console.error('Error en generatePreInvoice:', error)
    return { success: false, error: (error as Error).message }
  }
}

// --- CREAR ORGANIZACIÓN ---
export async function createOrganization(name: string) {
  const supabase = createAdminClient()

  try {
    const { error } = await supabase
      .from('organizations')
      .insert([{ name }])

    if (error) throw error

    revalidatePath('/admin/organizations')
    return { success: true, error: null }
  } catch (error) {
    console.error('Error en createOrganization:', error)
    return { success: false, error: (error as Error).message }
  }
}

// --- OBTENER TODAS LAS ORGANIZACIONES ---
export async function getOrganizations() {
  const supabase = createAdminClient()

  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('name')

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('Error en getOrganizations:', error)
    return []
  }
}

// --- ELIMINAR ORGANIZACIÓN ---
export async function deleteOrganization(id: string) {
  const supabase = createAdminClient()

  try {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id)

    if (error) throw error

    revalidatePath('/admin/organizations')
    return { success: true, error: null }
  } catch (error) {
    console.error('Error en deleteOrganization:', error)
    return { success: false, error: (error as Error).message }
  }
}

// --- ACTUALIZAR USUARIO ---
export async function updateUserProfile(userId: string, updates: any) {
  const supabase = createAdminClient()

  try {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (error) throw error

    revalidatePath('/admin/users')
    return { success: true, error: null }
  } catch (error) {
    console.error('Error en updateUserProfile:', error)
    return { success: false, error: (error as Error).message }
  }
}