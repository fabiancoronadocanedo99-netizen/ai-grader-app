import type { Metadata } from "next";
import { Suspense } from 'react';
import "./globals.css";
import NavigationBar from '@/components/NavigationBar';

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
        {/* Envolvemos la NavigationBar con Suspense */}
        {/* Esto previene errores de hidratación y fallos en el build de Vercel */}
        <Suspense fallback={<div className="h-16 bg-[#e0e5ec] animate-pulse" />}>
          <NavigationBar />
        </Suspense>

        {children}
      </body>
    </html>
  );
}