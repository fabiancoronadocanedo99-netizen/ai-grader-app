import { createRouteHandlerClient } from '@supabase/ssr' // ¡Usa SSR para el servidor!
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic' // ¡Línea CRÍTICA para Vercel!

export async function GET(req: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Redirige al dashboard
  return NextResponse.redirect(new URL('/dashboard', req.url))
}