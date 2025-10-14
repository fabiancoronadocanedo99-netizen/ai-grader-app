import { NextResponse } from 'next/server';
import { getGeminiApiKey, getSupabaseConfig } from '@/config/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  let apiKey: string | null = null;
  let apiKeySource: string | null = null;
  let error: string | null = null;

  try {
    apiKey = getGeminiApiKey();
    // Si llegamos aquí, la key se encontró
    apiKeySource = 'Found via helper';
  } catch (e: any) {
    error = e.message;
  }

  const supabaseConfig = getSupabaseConfig();

  return NextResponse.json({
    success: !!apiKey,
    hasGeminiKey: !!apiKey,
    apiKeySource,
    hasSupabaseUrl: !!supabaseConfig.url,
    hasSupabaseServiceKey: !!supabaseConfig.serviceRoleKey,
    error,
    allEnvKeys: Object.keys(process.env).filter(k => 
      k.includes('GEMINI') || k.includes('SUPABASE') || k.includes('AI') || k.includes('GOOGLE')
    )
  });
}