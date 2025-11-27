'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Acción existente para crear organización
export async function createOrganization(name: string) {
  const supabase = createAdminClient()

  try {
    const { error } = await supabase
      .from('organizations')
      .insert([{ name }])

    if (error) throw error

    revalidatePath('/admin/organizations') // Opcional: Revalidar ruta si usas cache de Next.js
    return { success: true }
  } catch (error) {
    console.error('Error en createOrganization:', error)
    return { success: false, error: (error as Error).message }
  }
}

// --- NUEVA FUNCIÓN: Obtener Organizaciones ---
export async function getOrganizations() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('organizations')
    .select('id, name')
    .order('name')

  if (error) {
    console.error('Error obteniendo organizaciones:', error)
    return []
  }

  return data
}