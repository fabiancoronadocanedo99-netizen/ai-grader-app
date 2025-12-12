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
    email_confirm: true,
  })

  if (authError) {
    console.error('Error creando usuario en Auth:', authError)
    return { success: false, error: authError.message }
  }

  if (!authData.user) {
    return { success: false, error: 'No se pudo crear el usuario en Auth' }
  }

  // --- ¡CAMBIO CRÍTICO! ---
  // 2. Ahora hacemos un INSERT en profiles, ya que no hay trigger
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id, // Usamos el ID del usuario recién creado
      full_name: data.fullName,
      role: data.role,
      organization_id: data.organizationId,
      onboarding_completed: true // Lo creamos ya completo
    })

  if (profileError) {
    console.error('Error creando el perfil en la base de datos:', profileError)
    // Limpieza: si falla el perfil, borramos el usuario de auth para no dejar basura
    await supabase.auth.admin.deleteUser(authData.user.id)
    return { success: false, error: 'Error de base de datos creando el perfil: ' + profileError.message }
  }

  revalidatePath('/admin/users')
  return { success: true }
}

export async function getUsers() {
  const supabase = createAdminClient()

  // Seleccionamos perfiles y hacemos JOIN con organizaciones para traer el nombre
  const { data, error } = await supabase
    .from('profiles')
    .select('*, organizations(name)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error obteniendo usuarios:', error)
    return []
  }

  // Pequeña corrección para asegurar que el nombre de la organización sea accesible
  return data.map(user => {
    // @ts-ignore
    const orgName = user.organizations ? user.organizations.name : 'Sin Asignar';
    return { ...user, organization_name: orgName };
  });
}