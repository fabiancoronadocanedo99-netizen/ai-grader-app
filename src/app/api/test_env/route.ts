import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  const allEnvKeys = Object.keys(process.env);
  return NextResponse.json({
    hasResendKey: !!process.env.RESEND_API_KEY,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    resendKeyStart: process.env.RESEND_API_KEY?.substring(0, 5) || null,
    allEnvKeys: allEnvKeys
  });
}