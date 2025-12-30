'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import Papa from 'papaparse' // Importamos la librería para CSV

// --- Tipos para el CSV ---
type CSVUser = {
  full_name: string
  email: string
  password: string
  role: string
  organization_name: string
}

type BulkImportResult = {
  success: boolean
  createdCount: number
  failedCount: number
  errors: string[]
}

// --- FUNCIONES EXISTENTES ---

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
    console.error(`--- [CREATE_USER] Error de Supabase Auth para ${data.email}:`, authError)
    return { success: false, error: authError.message }
  }

  if (!authData.user) {
    return { success: false, error: 'No se pudo crear el usuario en Auth' }
  }

  // 2. Ahora hacemos un INSERT en profiles
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      full_name: data.fullName,
      role: data.role,
      organization_id: data.organizationId,
      onboarding_completed: true
    })

  if (profileError) {
    console.error('Error creando el perfil en la base de datos:', profileError)
    // Limpieza: si falla el perfil, borramos el usuario de auth
    await supabase.auth.admin.deleteUser(authData.user.id)
    return { success: false, error: 'Error de base de datos creando el perfil: ' + profileError.message }
  }

  revalidatePath('/admin/users')
  return { success: true }
}

export async function getUsers() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('*, organizations(name)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error obteniendo usuarios:', error)
    return []
  }

  return data.map(user => {
    // @ts-ignore
    const orgName = user.organizations ? user.organizations.name : 'Sin Asignar';
    return { ...user, organization_name: orgName };
  });
}

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
    const profileUpdates: any = {}

    if (updates.fullName !== undefined) profileUpdates.full_name = updates.fullName
    if (updates.role !== undefined) profileUpdates.role = updates.role
    if (updates.organizationId !== undefined) profileUpdates.organization_id = updates.organizationId

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

export async function deleteUser(userId: string) {
  const supabase = createAdminClient()

  try {
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)
    if (authError) throw authError

    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      console.warn('Advertencia al borrar perfil:', profileError)
    }

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    console.error('Error en deleteUser:', error)
    return { success: false, error: (error as Error).message }
  }
}

// --- CREACIÓN MASIVA (CSV) ---

export async function createUsersFromCSV(csvContent: string): Promise<BulkImportResult> {
  console.log('--- [BULK] Iniciando proceso de CSV ---')
  let createdCount = 0
  let failedCount = 0
  const errors: string[] = []
  const supabase = createAdminClient()

  try {
    const { data: allOrgs } = await supabase.from('organizations').select('id, name')
    if (!allOrgs) throw new Error("No se pudieron cargar las organizaciones")

    console.log(`--- [BULK] Organizaciones cargadas: ${allOrgs.length}`)

    const users = Papa.parse(csvContent, { header: true, skipEmptyLines: true }).data as any[]
    console.log(`--- [BULK] CSV parseado. ${users.length} usuarios encontrados.`)

    for (const user of users) {
      try {
        const org = allOrgs.find(o => o.name === user.organization_name)
        if (!org) {
          throw new Error(`Organización '${user.organization_name}' no encontrada.`)
        }

        const result = await createUser({
          email: user.email,
          password: user.password,
          fullName: user.full_name,
          role: user.role,
          organizationId: org.id,
        })

        if (result.success) {
          createdCount++
        } else {
          throw new Error(result.error)
        }
      } catch (error) {
        errors.push(`Fila para ${user.email}: ${(error as Error).message}`)
        failedCount++
      }
    }

    revalidatePath('/admin/users')
    return { success: true, createdCount, failedCount, errors }

  } catch (error) {
    console.error('--- [BULK] ERROR MAYOR en createUsersFromCSV:', error)
    return { 
      success: false, 
      createdCount: 0, 
      failedCount: 0, 
      errors: [(error as Error).message] 
    }
  }
}

// --- NUEVA FUNCIÓN: Actualizar Límite de Crédito (Seguro) ---
export async function updateUserCreditLimit(targetUserId: string, newLimit: number) {
  const supabase = createAdminClient()

  try {
    // 1. Obtener al usuario que llama a la función (Admin actual)
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !currentUser) {
      throw new Error('No estás autenticado.')
    }

    // 2. Verificar que el usuario actual es ADMIN y obtener su Organization ID
    const { data: adminProfile, error: adminProfileError } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', currentUser.id)
      .single()

    if (adminProfileError || !adminProfile) {
      throw new Error('No se pudo obtener tu perfil de administrador.')
    }

    if (adminProfile.role !== 'admin') {
      throw new Error('Permisos insuficientes. Solo los administradores pueden realizar esta acción.')
    }

    // 3. Verificar al usuario OBJETIVO (Target)
    const { data: targetProfile, error: targetProfileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', targetUserId)
      .single()

    if (targetProfileError || !targetProfile) {
      throw new Error('Usuario objetivo no encontrado.')
    }

    // 4. Verificación de Seguridad: ¿Pertenecen a la misma organización?
    // Esto evita que un admin modifique usuarios de otra escuela.
    if (adminProfile.organization_id !== targetProfile.organization_id) {
      throw new Error('Acceso denegado: No puedes modificar usuarios que no pertenecen a tu organización.')
    }

    // 5. Ejecutar la actualización
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ monthly_credit_limit: newLimit })
      .eq('id', targetUserId)

    if (updateError) {
      throw updateError
    }

    // 6. Revalidar la página del dashboard
    revalidatePath('/dashboard/admin')

    return { success: true }

  } catch (error) {
    console.error('Error en updateUserCreditLimit:', error)
    return { success: false, error: (error as Error).message }
  }
}