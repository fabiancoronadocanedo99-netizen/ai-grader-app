import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Helper para obtener variables de entorno de forma segura
const getEnvVar = (key: string, backupKey?: string) => {
  const value = process.env[key] || (backupKey ? process.env[backupKey] : undefined);
  if (!value) {
    // Si estamos en build time, no lanzamos error, pero en runtime sí es crítico
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production') {
      console.warn(`[Supabase Config] Advertencia: Variable ${key} no encontrada.`);
    }
  }
  return value || '';
}

export function createClient() {
  const cookieStore = cookies()

  const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL');
  const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Ignorar en Server Components
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Ignorar en Server Components
          }
        },
      },
    }
  )
}

export function createAdminClient() {
  const cookieStore = cookies()

  const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL');
  const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

  return createServerClient(
    supabaseUrl,
    supabaseServiceKey, 
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {},
        remove(name: string, options: CookieOptions) {},
      },
    }
  )
}