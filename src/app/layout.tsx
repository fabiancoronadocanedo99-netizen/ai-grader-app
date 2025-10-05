import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavigationProvider } from '@/contexts/NavigationContext';
import NavigationBar from '@/components/NavigationBar';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Grader - Sistema de Calificación",
  description: "Sistema de calificación automatizada con IA para educadores",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NavigationProvider>
          <NavigationBar />
          <main className="min-h-[calc(100vh-4rem)]">
            {children}
          </main>
          {/* CommandPalette ha sido eliminado de aquí */}
        </NavigationProvider>
      </body>
    </html>
  );
}