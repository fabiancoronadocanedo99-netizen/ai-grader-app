import { createClient } from '@supabase/supabase-js'

// Cliente con privilegios de Dios (Service Role)
// ÚSALO SOLO EN EL SERVIDOR (Layouts, APIs)
export function createAdminClient() {
  return createClient(
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