/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! Advertencia !!
    // Esto permite que tu proyecto se construya (build) incluso si tiene errores de TypeScript.
    // Es útil para desplegar rápidamente, pero deberías arreglar los errores a largo plazo.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Advertencia: Esto deshabilita ESLint durante el build.
    // Es útil para desplegar, pero es recomendable arreglar los warnings.
    ignoreDuringBuilds: true,
  },
}

export default nextConfig