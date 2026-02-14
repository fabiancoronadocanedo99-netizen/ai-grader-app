export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

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
        {/* La combinación de 'force-dynamic' y Suspense asegura que 
            NavigationBar nunca rompa el servidor ni el cliente.
        */}
        <Suspense fallback={<div className="h-16 bg-[#e0e5ec] animate-pulse" />}>
          <NavigationBar />
        </Suspense>

        {children}
      </body>
    </html>
  );
}