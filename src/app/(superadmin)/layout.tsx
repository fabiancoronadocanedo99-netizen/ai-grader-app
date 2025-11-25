import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import React from 'react'

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  console.log("--- [DEBUG] INICIANDO SUPERADMIN LAYOUT CHECK ---");

  // 1. Cliente para leer la sesión del usuario (cookies)
  const cookieStore = await cookies()

  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  const { data: { user } } = await supabaseAuth.auth.getUser()

  console.log("--- [DEBUG] Usuario encontrado:", user?.id);

  if (!user) {
    console.log('--- [DEBUG] Acceso denegado: No hay usuario. Redirigiendo a /login')
    return redirect('/login')
  }

  // 2. Cliente Admin para consultar la base de datos con privilegios
  const supabaseAdmin = createAdminClient()

  console.log("--- [DEBUG] Consultando perfil para usuario:", user.id);

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  console.log("--- [DEBUG] Perfil encontrado:", profile);

  if (profile) {
    console.log("--- [DEBUG] Rol detectado:", profile.role);
  }

  // 3. Verificación de seguridad
  if (profileError || !profile || profile.role !== 'superadmin') {
    console.log(`--- [DEBUG] Acceso denegado a SuperAdmin. Redirigiendo a /dashboard`)
    return redirect('/dashboard')
  }

  console.log(`--- [DEBUG] Acceso concedido. Renderizando panel de admin.`)

  return <>{children}</>
}