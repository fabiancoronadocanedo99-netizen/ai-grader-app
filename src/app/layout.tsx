import type { Metadata } from "next";
import { Suspense } from 'react';
import "./globals.css";
import NavigationBar from '@/components/NavigationBar';

// --- AÑADE ESTA LÍNEA AQUÍ PARA VERCEL ---
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "AI Grader - Plataforma de Evaluación",
  description: "Automatiza tu calificación con IA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="neu-container min-h-screen">
        <Suspense fallback={<div className="h-16 bg-[#e0e5ec] animate-pulse" />}>
          <NavigationBar />
        </Suspense>

        {children}
      </body>
    </html>
  );
}