import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/app/globals.css"; // Usamos ruta absoluta por seguridad
import NavigationBar from "@/components/NavigationBar"; // Asegúrate de que esta sea la ruta correcta de tu componente

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Grader - Super Admin",
  description: "Panel de administración global de AI Grader",
};

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-[#e0e5ec] min-h-screen text-gray-700`}>
        {/* Barra de Navegación común */}
        <NavigationBar />

        {/* Contenido de las páginas de administración */}
        <div className="pt-4">
          {children}
        </div>
      </body>
    </html>
  );
}