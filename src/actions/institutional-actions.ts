'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * Obtiene datos agregados para el Dashboard Institucional (Organización Padre -> Hijas)
 */
export async function getInstitutionalDashboardData() {
  const supabase = createAdminClient()

  try {
    // 1. Obtener el usuario actual para identificar su organización
    const authClient = createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()

    if (authError || !user) throw new Error('No autorizado')

    // 2. Obtener la organización del usuario (La Organización PADRE)
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile?.organization_id) {
      throw new Error('No se pudo determinar la organización principal')
    }

    const parentId = userProfile.organization_id

    // 3. Obtener todas las organizaciones hijas
    const { data: daughterOrgs, error: orgsError } = await supabase
      .from('organizations')
      .select('*')
      .eq('parent_id', parentId)

    if (orgsError) throw orgsError

    // 4. Recopilar datos detallados de cada escuela hija
    const detailedOrgs = await Promise.all((daughterOrgs || []).map(async (org: any) => {
      // Contar usuarios
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)

      // Obtener promedio general de evaluaciones
      const { data: grades } = await supabase
        .from('grades')
        .select('score_obtained, score_possible')
        .eq('organization_id', org.id)

      const totalScore = grades?.reduce((sum: number, g: any) => sum + (g.score_obtained / (g.score_possible || 1)), 0) || 0
      const average = grades && grades.length > 0 ? (totalScore / grades.length) * 100 : 0

      return {
        id: org.id,
        name: org.name,
        level: org.education_level || 'N/A',
        userCount: userCount || 0,
        average: Math.round(average),
        creditsRemaining: org.credits_remaining || 0,
        status: average >= 80 ? 'Exitoso' : average >= 60 ? 'En Riesgo' : 'Crítico'
      }
    }))

    // 5. Calcular Resumen Global
    const globalStats = {
      totalSchools: detailedOrgs.length,
      totalUsers: detailedOrgs.reduce((sum: number, org: any) => sum + org.userCount, 0),
      globalAverage: detailedOrgs.length > 0 
        ? Math.round(detailedOrgs.reduce((sum: number, org: any) => sum + org.average, 0) / detailedOrgs.length) 
        : 0
    }

    return { success: true, schools: detailedOrgs, stats: globalStats }

  } catch (error) {
    console.error('Error en Institutional Dashboard:', error)
    return { success: false, error: (error as Error).message, schools: [], stats: { totalSchools: 0, totalUsers: 0, globalAverage: 0 } }
  }
}