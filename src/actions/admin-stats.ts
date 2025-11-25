'use server'
import { createAdminClient } from '@/lib/supabase/server'

export async function getAdminStats() {
  const supabase = createAdminClient()

  // Ejecutamos las 3 consultas en paralelo para velocidad
  const [orgs, users, evals] = await Promise.all([
    supabase.from('organizations').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('exams').select('*', { count: 'exact', head: true }) // O 'grades' si prefieres
  ])

  return {
    organizations: orgs.count || 0,
    users: users.count || 0,
    evaluations: evals.count || 0
  }
}