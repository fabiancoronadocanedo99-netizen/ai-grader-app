import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import React from 'react'

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  console.log("--- [DEBUG] INICIANDO SUPERADMIN LAYOUT CHECK ---");

  const supabase = createAdminClient()

  // 1. Obtener el usuario actual
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError) {
    console.error("--- [DEBUG] Error al obtener usuario:", authError);
  }

  console.log("--- [DEBUG] Usuario encontrado:", user?.id);

  // Si no hay usuario, redirigir a login
  if (!user) {
    console.log('--- [DEBUG] Acceso denegado: No hay usuario. Redirigiendo a /login')
    return redirect('/login')
  }

  // 2. Obtener el perfil para verificar el rol
  console.log("--- [DEBUG] Consultando perfil para usuario:", user.id);
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  console.log("--- [DEBUG] Perfil encontrado:", profile);
  console.log("--- [DEBUG] Error de perfil:", profileError);

  if (profile) {
    console.log("--- [DEBUG] Rol detectado:", profile.role);
    console.log("--- [DEBUG] ¿Es superadmin?:", profile.role === 'superadmin');
  }

  // 3. Verificación de seguridad
  if (profileError || !profile || profile.role !== 'superadmin') {
    console.log(`--- [DEBUG] Acceso denegado a SuperAdmin. Redirigiendo a /dashboard`)
    return redirect('/dashboard')
  }

  console.log(`--- [DEBUG] Acceso concedido. Renderizando panel de admin.`)

  // 4. Renderizar contenido si es superadmin
  return <>{children}</>
}