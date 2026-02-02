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
}

/**
 * Genera una pre-factura y la envía por correo
 */
export async function generatePreInvoice(organizationId: string) {
  console.log("Generando pre-factura para:", organizationId)
  return { success: true, message: "Funcionalidad en desarrollo" }
}

/**
 * Importa organizaciones masivamente desde un CSV (Texto plano)
 * Formato esperado: name, subdomain, director_name, director_email, education_level
 */
export async function createOrganizationsFromCSV(csvContent: string) {
  const supabase = createAdminClient()

  // Dividir por líneas (soporta saltos de línea windows/unix)
  const rows = csvContent.split(/\r?\n/)

  let created = 0
  let errors = 0

  // Fecha de renovación + 1 mes
  const nextRenewal = new Date()
  nextRenewal.setMonth(nextRenewal.getMonth() + 1)

  // Empezamos en i=1 asumiendo que la primera fila es el encabezado
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i].trim()
    if (!row) continue // Saltar líneas vacías

    // Separar por comas
    const columns = row.split(',')

    // Mapear columnas según orden esperado
    const name = columns[0]?.trim()
    const subdomain = columns[1]?.trim()
    const director_name = columns[2]?.trim()
    const director_email = columns[3]?.trim()
    const education_level = columns[4]?.trim()

    // Validación mínima: Debe tener nombre
    if (!name) {
      errors++
      continue
    }

    try {
      const { error } = await supabase
        .from('organizations')
        .insert({
          name,
          subdomain,
          director_name,
          director_email,
          education_level, 
          // Valores por defecto
          subscription_plan: 'Basic',
          credits_total_period: 15000,
          credits_remaining: 15000,
          next_renewal_date: nextRenewal.toISOString()
        })

      if (error) throw error
      created++

    } catch (error) {
      console.error(`Error en fila ${i} (${name}):`, error)
      errors++
    }
  }

  if (created > 0) {
    revalidatePath('/admin/organizations')
  }

  return { success: true, created, errors }
}

/**
 * Obtiene datos para el Dashboard Institucional (Organización Padre -> Hijas)
 */
export async function getInstitutionalDashboardData() {
  const supabase = createAdminClient()

  try {
    // 1. Obtener el usuario actual
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) throw new Error('No autorizado')

    // 2. Obtener el ID de la organización del usuario (Padre)
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile?.organization_id) {
      throw new Error('No se encontró la organización del usuario')
    }

    const parentId = userProfile.organization_id

    // 3. Buscar Organizaciones Hijas
    const { data: childOrgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name, education_level, credits_total_period, credits_remaining')
      .eq('parent_id', parentId)
      .order('name')

    if (orgsError) throw orgsError

    if (!childOrgs || childOrgs.length === 0) {
      return { success: true, data: [] }
    }

    // 4. Calcular métricas para cada escuela hija
    const dashboardData = await Promise.all(childOrgs.map(async (org) => {

      // A. Total de Alumnos
      const { count: studentsCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)

      // B. Total de Maestros
      const { count: teachersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .eq('role', 'teacher')

      // C. Promedio General
      const { data: evaluations } = await supabase
        .from('evaluations')
        .select('grade, students!inner(organization_id)')
        .eq('students.organization_id', org.id)

      let averageGrade = 0
      if (evaluations && evaluations.length > 0) {
        const totalGrades = evaluations.reduce((sum, current) => sum + (current.grade || 0), 0)
        averageGrade = totalGrades / evaluations.length
      }

      const totalCredits = org.credits_total_period || 0
      const remainingCredits = org.credits_remaining || 0
      const consumedCredits = totalCredits - remainingCredits

      return {
        id: org.id,
        name: org.name,
        education_level: org.education_level,
        students: studentsCount || 0,
        teachers: teachersCount || 0,
        average: parseFloat(averageGrade.toFixed(1)),
        credits_consumed: consumedCredits,
        credits_total: totalCredits
      }
    }))

    return { success: true, data: dashboardData }

  } catch (error) {
    console.error('Error en getInstitutionalDashboardData:', error)
    return { success: false, error: (error as Error).message }
  }
}