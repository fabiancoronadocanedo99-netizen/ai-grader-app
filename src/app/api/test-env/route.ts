import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    hasAiApiKey: !!process.env.SUPABASE_GEMINI_KEY,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    allEnvKeys: Object.keys(process.env).filter(k => 
      k.includes('AI') || k.includes('SUPABASE')
    )
  });
}