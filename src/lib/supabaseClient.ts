import { createBrowserClient } from '@supabase/ssr'

// Crea un cliente de Supabase PARA EL NAVEGADOR (client-side)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}