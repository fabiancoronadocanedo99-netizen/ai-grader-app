'use client'

import CommandPalette from '@/components/CommandPalette'
import NavigationBar from '@/components/NavigationBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#d1d9e6]"> {/* Fondo general neumórfico */}

      {/* 1. La barra única e inteligente */}
      <NavigationBar />

      {/* 2. El contenido de la página */}
      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        {children}
      </main>

      {/* 3. El buscador rápido (Cmd+K) */}
      <CommandPalette />
    </div>
  )
}