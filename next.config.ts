/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración segura para Replit
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
};

export default nextConfig;
