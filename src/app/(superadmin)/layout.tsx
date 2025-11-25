import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import React from 'react'

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 👇 CAMBIO AQUÍ: Agregamos 'await' porque createClient ahora es asíncrono
  const supabase = await createClient()

  // 1. Obtener el usuario actual
  const { data: { user } } = await supabase.auth.getUser()

  // Si no hay usuario, redirigir a login
  if (!user) {
    console.log('Acceso denegado a SuperAdmin: No hay usuario')
    return redirect('/login')
  }

  // 2. Obtener el perfil para verificar el rol
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // 3. Verificación de seguridad
  if (profileError || !profile || profile.role !== 'superadmin') {
    console.log(`Acceso denegado a SuperAdmin para usuario ${user.id}. Rol: ${profile?.role}`)
    // Si está logueado pero no es superadmin, lo mandamos a su dashboard normal
    return redirect('/dashboard')
  }

  console.log(`Acceso concedido a SuperAdmin para usuario ${user.id}`)

  // 4. Renderizar contenido si es superadmin
  return <>{children}</>
}