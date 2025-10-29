import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    // Prueba #1: El nombre correcto
    hasResendKey: !!process.env.RESEND_API_KEY,
    resendKeyStart: process.env.RESEND_API_KEY?.substring(0, 5) || null,

    // Prueba #2: El alias
    hasEmailKey: !!process.env.EMAIL_API_KEY,
    emailKeyStart: process.env.EMAIL_API_KEY?.substring(0, 5) || null,

    // Prueba #3: El camuflaje
    hasGoogleKey: !!process.env.GOOGLE_AI_API_KEY,
    googleKeyStart: process.env.GOOGLE_AI_API_KEY?.substring(0, 5) || null,
  });
}