import { NextResponse } from 'next/server';
import { getGeminiApiKey } from '@/config/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const apiKey = getGeminiApiKey();

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1/models',
      {
        headers: {
          'x-goog-api-key': apiKey,
        },
      }
    );

    const data = await response.json();

    return NextResponse.json({
      models: data.models?.map((m: any) => ({
        name: m.name,
        displayName: m.displayName,
        supportedGenerationMethods: m.supportedGenerationMethods,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}