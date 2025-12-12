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
  errors: Array<{ email: string; reason: string }>
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
    console.error('Error creando usuario en Auth:', authError)
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

// --- NUEVA FUNCIÓN: Creación Masiva ---

export async function createUsersFromCSV(csvContent: string): Promise<BulkImportResult> {
  const supabase = createAdminClient()

  // 1. Parsear el CSV
  const parseResult = Papa.parse<CSVUser>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase().replace(/\s/g, '_'), // Normalizar headers
  })

  const rows = parseResult.data

  let createdCount = 0
  let failedCount = 0
  const errors: Array<{ email: string; reason: string }> = []

  // Si hay errores de parseo (formato CSV inválido global)
  if (parseResult.errors.length > 0) {
    return {
      success: false,
      createdCount: 0,
      failedCount: 0,
      errors: [{ email: 'GENERAL', reason: 'El archivo CSV tiene un formato inválido.' }]
    }
  }

  // 2. Iterar sobre cada usuario
  for (const row of rows) {
    const email = row.email?.trim()
    const password = row.password?.trim()
    const fullName = row.full_name?.trim()
    const role = row.role?.trim()
    const orgName = row.organization_name?.trim()

    // Validación básica de campos obligatorios
    if (!email || !password || !orgName) {
      failedCount++
      errors.push({ 
        email: email || 'Desconocido', 
        reason: 'Faltan campos obligatorios (email, password o organization_name)' 
      })
      continue
    }

    try {
      // a. Buscar la organización por nombre
      // Nota: Es sensible a mayúsculas/minúsculas exactas a menos que uses ilike o modifiques la BD.
      // Usaremos ilike para ser un poco más flexibles con el nombre.
      const { data: orgData, error: orgSearchError } = await supabase
        .from('organizations')
        .select('id')
        .ilike('name', orgName) 
        .maybeSingle() // maybeSingle evita error si no encuentra, devuelve null

      if (orgSearchError) {
        failedCount++
        errors.push({ email, reason: `Error buscando organización: ${orgSearchError.message}` })
        continue
      }

      if (!orgData) {
        failedCount++
        errors.push({ email, reason: `La organización "${orgName}" no existe.` })
        continue
      }

      // b. Llamar a createUser con el ID encontrado
      const result = await createUser({
        email,
        password,
        role: role || 'user', // Rol por defecto si viene vacío
        fullName: fullName || '',
        organizationId: orgData.id
      })

      if (result.success) {
        createdCount++
      } else {
        failedCount++
        errors.push({ email, reason: result.error || 'Error desconocido al crear usuario' })
      }

    } catch (err) {
      failedCount++
      errors.push({ email, reason: `Excepción inesperada: ${(err as Error).message}` })
    }
  }

  // Revalidar rutas si hubo éxito
  if (createdCount > 0) {
    revalidatePath('/admin/users')
  }

  return {
    success: true,
    createdCount,
    failedCount,
    errors
  }
}