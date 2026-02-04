'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

/**
 * Registra un evento de auditoría en la base de datos.
 * Esta función es "fire-and-forget" desde la UI, pero asegura integridad usando el admin client.
 */
export async function logEvent(
  action: string,
  entityType: string,
  entityId: string,
  details: any
) {
  try {
    // 1. Obtener el usuario actual (Sesión estándar)
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.warn('Intento de log de auditoría sin usuario autenticado:', action)
      return { success: false, error: 'Usuario no autenticado' }
    }

    // 2. Cliente Admin para permisos de escritura/lectura completa
    const adminClient = createAdminClient()

    // 3. Obtener Organization ID del perfil del usuario
    const { data: profile } = await adminClient
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    // 4. Obtener IP de los headers
    const headersList = headers()
    const forwardedFor = headersList.get('x-forwarded-for')
    // Si hay múltiples IPs (proxies), tomamos la primera
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : 'unknown'

    // 5. Insertar el log
    const { error: insertError } = await adminClient
      .from('audit_logs')
      .insert({
        user_id: user.id,
        user_email: user.email,
        organization_id: profile?.organization_id || null,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
        ip_address: ipAddress,
        // created_at se genera automáticamente en BD
      })

    if (insertError) {
      console.error('Error insertando audit log:', insertError)
      return { success: false, error: insertError.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error crítico en logEvent:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Obtiene los últimos 100 registros de auditoría
 */
export async function getAuditLogs() {
  const supabase = createAdminClient()

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    return { success: true, data }
  } catch (error) {
    console.error('Error obteniendo logs:', error)
    return { success: false, data: [] }
  }
}