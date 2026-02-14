'use client'

import CommandPalette from '@/components/CommandPalette'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#d1d9e6]"> {/* Fondo general neumórfico */}

      {/* CIRUGÍA: Se eliminó NavigationBar de aquí para evitar duplicidad */}

      {/* 1. El contenido de la página */}
      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        {children}
      </main>

      {/* 2. El buscador rápido (Cmd+K) */}
      <CommandPalette />
    </div>
  )
}