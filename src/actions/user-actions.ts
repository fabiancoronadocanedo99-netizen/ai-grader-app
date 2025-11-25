'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createUser(data: {
  email: string
  password: string
  role: string
  organizationId: string
  fullName: string
}) {
  const supabase = createAdminClient()

  // 1. Crear el usuario en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true, // Auto-confirmar para que puedan entrar ya
    user_metadata: { full_name: data.fullName }
  })

  if (authError) {
    console.error('Error creando usuario auth:', authError)
    return { success: false, error: authError.message }
  }

  if (!authData.user) {
    return { success: false, error: 'No se pudo crear el usuario' }
  }

  // 2. Actualizar el perfil con el rol y la organización
  // (El trigger 'on_auth_user_created' ya creó la fila en 'profiles', ahora la actualizamos)
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      role: data.role,
      organization_id: data.organizationId,
      full_name: data.fullName
    })
    .eq('id', authData.user.id)

  if (profileError) {
    console.error('Error actualizando perfil:', profileError)
    // Opcional: Podríamos borrar el usuario de auth si esto falla para no dejar basura
    return { success: false, error: 'Usuario creado pero falló al asignar perfil: ' + profileError.message }
  }

  revalidatePath('/admin/users')
  return { success: true }
}