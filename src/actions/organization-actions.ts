'use server'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// --- Acción existente para crear organización ---
export async function createOrganization(name: string) {
  const supabase = createAdminClient()
  try {
    const { error } = await supabase
      .from('organizations')
      .insert([{ name }])
    if (error) throw error
 feature/credit-system

    revalidatePath('/admin/organizations')
    revalidatePath('/admin/organizations') // Opcional: Revalidar ruta si usas cache de Next.js
 main
    return { success: true }
  } catch (error) {
    console.error('Error en createOrganization:', error)
    return { success: false, error: (error as Error).message }
  }
}
 feature/credit-system
// --- Acción existente para obtener organizaciones ---

// --- FUNCIÓN: Obtener Organizaciones ---
 main
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

 feature/credit-system
// --- FUNCIÓN ACTUALIZADA: Actualizar Organización ---
export async function updateOrganization(id: string, updates: {
  name?: string;
  subscription_plan?: string | null;
  credits_per_period?: number | null;
  credits_remaining?: number | null;
  next_renewal_date?: string | null;
}) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('organizations')
    .update(updates) // <-- Usamos el objeto 'updates' directamente
    .eq('id', id);

  if (error) {
    console.error('Error actualizando organización:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/organizations');
  return { success: true };
}

// --- Acción existente para eliminar organización ---

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
 main
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