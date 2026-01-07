'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/**
 * Obtiene la lista de todas las organizaciones
 */
export async function getOrganizations() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('name')

  if (error) {
    console.error('Error obteniendo organizaciones:', error)
    return []
  }
  return data
}

/**
 * Crea una nueva organización
 */
export async function createOrganization(name: string) {
  const supabase = createAdminClient()
  try {
    const { data, error } = await supabase
      .from('organizations')
      .insert([{ name }])
      .select()
      .single()

    if (error) throw error
    revalidatePath('/admin/organizations')
    return { success: true, data }
  } catch (error) {
    console.error('Error:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Obtiene los detalles de una organización y sus usuarios (Saltando RLS)
 */
export async function getOrganizationDetails(id: string) {
  const supabase = createAdminClient()

  try {
    // 1. Datos de la organización
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single()

    if (orgError) throw orgError

    // 2. Lista de usuarios de esa organización
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', id)
      .order('full_name', { ascending: true })

    if (usersError) throw usersError

    return { organization, users, error: null }
  } catch (error) {
    console.error('Error:', error)
    return { organization: null, users: [], error: (error as Error).message }
  }
}

/**
 * Actualiza campos genéricos de la organización (CRM, Facturación, etc.)
 */
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
    console.error('Error:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Asigna un plan y sus créditos correspondientes
 */
export async function assignPlanToOrganization(organizationId: string, plan: 'Basic' | 'Pro' | 'Enterprise') {
  const supabase = createAdminClient()

  let credits = 0
  switch (plan) {
    case 'Basic': credits = 15000; break
    case 'Pro': credits = 30000; break
    case 'Enterprise': credits = 99999; break
  }

  // Próxima renovación en 1 mes
  const nextRenewal = new Date()
  nextRenewal.setMonth(nextRenewal.getMonth() + 1)

  try {
    const { error } = await supabase
      .from('organizations')
      .update({
        subscription_plan: plan,
        credits_total_period: credits,
        credits_remaining: credits,
        next_renewal_date: nextRenewal.toISOString()
      })
      .eq('id', organizationId)

    if (error) throw error
    revalidatePath(`/admin/organizations/${organizationId}`)
    return { success: true }
  } catch (error) {
    console.error('Error:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Sube el logo de la organización al bucket de Storage
 */
export async function uploadOrganizationLogo(organizationId: string, formData: FormData) {
  const supabase = createAdminClient()
  const file = formData.get('logoFile') as File
  if (!file) return { success: false, error: 'No se recibió ningún archivo' }

  const fileExt = file.name.split('.').pop()
  const fileName = `logo_${organizationId}_${Date.now()}.${fileExt}`

  try {
    // 1. Subir al Storage
    const { error: uploadError } = await supabase.storage
      .from('organization_logos')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    // 2. Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('organization_logos')
      .getPublicUrl(fileName)

    // 3. Actualizar en la tabla de organizaciones
    const { error: updateError } = await supabase
      .from('organizations')
      .update({ logo_url: publicUrl })
      .eq('id', organizationId)

    if (updateError) throw updateError

    revalidatePath(`/admin/organizations/${organizationId}`)
    return { success: true, url: publicUrl }
  } catch (error) {
    console.error('Error:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Elimina una organización
 */
export async function deleteOrganization(id: string) {
  const supabase = createAdminClient()
  try {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id)

    if (error) throw error
    revalidatePath('/admin/organizations')
    return { success: true }
  } catch (error) {
    console.error('Error:', error)
    return { success: false, error: (error as Error).message }
  }
}/**
 * Genera una pre-factura y la envía por correo
 */
export async function generatePreInvoice(organizationId: string) {
  // Por ahora es un placeholder para que la app compile
  console.log("Generando pre-factura para:", organizationId)
  return { success: true, message: "Funcionalidad en desarrollo" }
}