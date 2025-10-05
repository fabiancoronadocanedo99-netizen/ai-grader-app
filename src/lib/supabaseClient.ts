import { createBrowserClient } from '@supabase/ssr'

// Esta función es nuestra nueva "fábrica"
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}