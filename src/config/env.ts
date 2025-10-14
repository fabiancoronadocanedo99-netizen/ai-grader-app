// src/config/env.ts

// Lista de todas las posibles variables donde podría estar la key
const possibleKeys = [
  'NEXT_PUBLIC_GEMINI_API_KEY',
  'GEMINI_API_KEY',
  'AI_API_KEY',
  'GOOGLE_AI_API_KEY',
  'SUPABASE_GEMINI_KEY',
] as const;

export function getGeminiApiKey(): string {
  // Intenta todas las posibles ubicaciones
  for (const key of possibleKeys) {
    const value = process.env[key];
    if (value) {
      console.log(`✅ API Key encontrada en: ${key}`);
      return value;
    }
  }

  // Si no encuentra ninguna, lanza error con debug info
  console.error('❌ No se encontró la API key en ninguna variable');
  console.error('Variables disponibles:', Object.keys(process.env).filter(k => 
    k.includes('GEMINI') || k.includes('AI') || k.includes('GOOGLE')
  ));

  throw new Error('No se pudo encontrar GEMINI_API_KEY en ninguna variable de entorno');
}

export function getSupabaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}