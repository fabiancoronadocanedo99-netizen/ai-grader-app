// 1. Importamos la función correcta con el nombre nuevo
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import React from 'react'

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 2. Creamos el cliente. NO lleva 'await' porque nuestra función createAdminClient es síncrona.
  const supabase = createAdminClient()

  // 3. Obtener el usuario actual
  const { data: { user } } = await supabase.auth.getUser()

  // Si no hay usuario, redirigir a login
  if (!user) {
    console.log('Acceso denegado a SuperAdmin: No hay usuario')
    return redirect('/login')
  }

  // 4. Obtener el perfil para verificar el rol
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // 5. Verificación de seguridad
  if (profileError || !profile || profile.role !== 'superadmin') {
    console.log(`Acceso denegado a SuperAdmin para usuario ${user.id}. Rol: ${profile?.role}`)
    // Si está logueado pero no es superadmin, lo mandamos a su dashboard normal
    return redirect('/dashboard')
  }

  console.log(`Acceso concedido a SuperAdmin para usuario ${user.id}`)

  // 6. Renderizar contenido si es superadmin
  return <>{children}</>
}