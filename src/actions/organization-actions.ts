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

// --- FUNCIÓN: Obtener Organizaciones ---
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

// --- NUEVA FUNCIÓN: Actualizar Organización ---
export async function updateOrganization(id: string, newName: string) {
  const supabase = createAdminClient()

  try {
    const { error } = await supabase
      .from('organizations')
      .update({ name: newName })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/admin/organizations')
    return { success: true }
  } catch (error) {
    console.error('Error en updateOrganization:', error)
    return { success: false, error: (error as Error).message }
  }
}

// --- NUEVA FUNCIÓN: Eliminar Organización ---
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
    console.error('Error en deleteOrganization:', error)
    return { success: false, error: (error as Error).message }
  }
}