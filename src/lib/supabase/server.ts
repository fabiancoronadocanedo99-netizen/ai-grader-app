import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// 1. Cliente Estándar
// Se usa en Layouts y Pages para saber quién es el usuario actual usando cookies.
export async function createClient() { // <--- 1. AGREGAR 'async' AQUÍ
  const cookieStore = await cookies() // <--- 2. AGREGAR 'await' AQUÍ

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // El método setAll fue llamado desde un Server Component.
            // Esto se puede ignorar si tienes middleware refrescando la sesión.
          }
        },
      },
    }
  )
}

// 2. Cliente Admin
// Se usa para ignorar reglas de seguridad (RLS).
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}