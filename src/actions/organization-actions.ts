'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createOrganization(name: string) {
  const supabase = createAdminClient()

  // 1. Verificar (opcional pero recomendado) si el usuario es superadmin
  // Aunque el layout ya protege la página, doble seguridad nunca sobra.

  const { error } = await supabase
    .from('organizations')
    .insert({ name })

  if (error) {
    console.error('Error creando organización:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/organizations') // Refrescar la lista
  return { success: true }
}