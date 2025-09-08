import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable strict mode for better performance in development
  reactStrictMode: false,
  // Allow external hosts for Replit's proxy environment
  allowedDevOrigins: ['*'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          }
        ]
      }
    ];
  }
}

export default nextConfig;
