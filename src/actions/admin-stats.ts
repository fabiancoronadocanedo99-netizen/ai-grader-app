'use server'
import { createAdminClient } from '@/lib/supabase/server'

export async function getAdminStats() {
  const supabase = createAdminClient() // Cambiado a Admin

  try {
    const [orgs, users, evals] = await Promise.all([
      supabase.from('organizations').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('exams').select('*', { count: 'exact', head: true })
    ])

    return {
      organizations: orgs.count || 0,
      users: users.count || 0,
      evaluations: evals.count || 0
    }
  } catch (error) {
    console.error('Error stats:', error)
    return { organizations: 0, users: 0, evaluations: 0 }
  }
}