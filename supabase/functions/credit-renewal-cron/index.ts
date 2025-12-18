import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

console.log('Credit Renewal Cron Function Initialized')

serve(async (_req: Request) => {
  try {
    // Inicializar cliente con permisos de administración
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date().toISOString()
    console.log(`Running credit renewal job at: ${now}`)

    // Buscar organizaciones vencidas
    const { data: orgsToRenew, error: fetchError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .lte('next_renewal_date', now)

    if (fetchError) throw fetchError

    if (!orgsToRenew || orgsToRenew.length === 0) {
      console.log('No organizations to renew. Exiting.')
      return new Response('No organizations to renew.', { status: 200 })
    }

    console.log(`Found ${orgsToRenew.length} organizations to renew.`)

    // Procesar cada organización
    for (const org of orgsToRenew) {
      console.log(`Processing organization: ${org.name} (ID: ${org.id})`)

      // Calcular nueva fecha
      const baseDate = new Date() // Fecha actual
      let newRenewalDate: Date

      if (org.subscription_plan === 'anual') {
        // Sumar 1 año
        baseDate.setFullYear(baseDate.getFullYear() + 1)
        newRenewalDate = baseDate
      } else {
        // Sumar 1 mes (por defecto)
        baseDate.setMonth(baseDate.getMonth() + 1)
        newRenewalDate = baseDate
      }

      const updates = {
        credits_remaining: org.credits_per_period,
        next_renewal_date: newRenewalDate.toISOString()
      }

      // Actualizar en base de datos
      const { error: updateError } = await supabaseAdmin
        .from('organizations')
        .update(updates)
        .eq('id', org.id)

      if (updateError) {
        console.error(`Failed to update org ${org.id}:`, updateError)
      } else {
        console.log(`Successfully renewed org ${org.id}.`)
      }
    }

    return new Response(JSON.stringify({ message: `Processed ${orgsToRenew.length} orgs.` }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Fatal error in cron function:', error)
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})