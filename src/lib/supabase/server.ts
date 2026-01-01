import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 1. Cliente para el USUARIO ACTUAL (Usa cookies de sesión)
// Este es el que necesitamos para que getCurrentUserProfile funcione.
export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Se ignora si se llama desde un Server Component (es normal)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Se ignora si se llama desde un Server Component
          }
        },
      },
    }
  )
}

// 2. Cliente ADMIN (Usa Service Role Key)
// Este lo mantenemos porque lo usan tus otras funciones de administración.
export function createAdminClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, 
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // No suele ser necesario setear cookies con el admin
        },
        remove(name: string, options: CookieOptions) {
          // No suele ser necesario borrar cookies con el admin
        },
      },
    }
  )
}