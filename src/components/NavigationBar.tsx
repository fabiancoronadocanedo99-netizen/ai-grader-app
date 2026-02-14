'use client'

import NavigationClient from './NavigationClient'

// Convertimos esto en un componente de cliente puro para evitar 
// que Vercel guarde copias viejas de tu identidad.
export default function NavigationBar() {
  return <NavigationClient />
}