import type { Metadata } from "next";
import { Inter } from "next/font/google"; // O tus fuentes 'Geist'
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Grader",
  description: "App para calificar exámenes con IA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}