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

// --- NUEVA FUNCIÓN: Actualizar Usuario ---
export async function updateUser(
  userId: string,
  updates: {
    fullName?: string
    role?: string
    organizationId?: string
  }
) {
  const supabase = createAdminClient()

  try {
    // Construir el objeto de actualización solo con los campos proporcionados
    const profileUpdates: any = {}

    if (updates.fullName !== undefined) {
      profileUpdates.full_name = updates.fullName
    }
    if (updates.role !== undefined) {
      profileUpdates.role = updates.role
    }
    if (updates.organizationId !== undefined) {
      profileUpdates.organization_id = updates.organizationId
    }

    // Actualizar el perfil en la tabla profiles
    const { error } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', userId)

    if (error) throw error

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    console.error('Error en updateUser:', error)
    return { success: false, error: (error as Error).message }
  }
}

// --- NUEVA FUNCIÓN: Eliminar Usuario ---
export async function deleteUser(userId: string) {
  const supabase = createAdminClient()

  try {
    // 1. Eliminar el usuario del sistema de autenticación
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)

    if (authError) throw authError

    // 2. Eliminar el perfil de la tabla profiles (por seguridad, aunque debería haber un trigger)
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    // No lanzamos error si falla el delete del perfil, ya que el trigger podría haberlo borrado
    if (profileError) {
      console.warn('Advertencia al borrar perfil (posiblemente ya borrado por trigger):', profileError)
    }

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    console.error('Error en deleteUser:', error)
    return { success: false, error: (error as Error).message }
  }
}