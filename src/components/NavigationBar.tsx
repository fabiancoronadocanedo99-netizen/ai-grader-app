// src/components/NavigationBar.tsx
import { getCurrentUserProfile } from '@/actions/user-actions'
import NavigationClient from './NavigationClient'

export default async function NavigationBar() {
  let userRole = undefined;
  let userEmail = undefined;

  try {
    // Intentamos obtener el perfil
    const profile = await getCurrentUserProfile();

    if (profile) {
      userRole = profile.role;
      userEmail = profile.email; // Asegúrate de que tu tabla profiles tenga columna email, si no, usa auth
    }
  } catch (error) {
    // Si falla, lo registramos en el servidor pero NO rompemos la UI
    console.error("CRITICAL NAVBAR ERROR:", error);
  }

  // Renderizamos el cliente pase lo que pase
  return (
    <NavigationClient 
      userRole={userRole} 
      userEmail={userEmail} 
    />
  )
}