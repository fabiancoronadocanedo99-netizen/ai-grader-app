import type { Metadata } from "next";
import "./globals.css";

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
        {/* Aquí NO hay NavigationBar. Así el Login queda limpio. */}
        {children}
      </body>
    </html>
  );
}