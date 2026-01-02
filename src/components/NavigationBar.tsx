'use client'

import { useEffect, useState } from 'react'
// Importamos la Server Action
import { getCurrentUserProfile } from '@/actions/user-actions'
// Importamos el cliente visual
import NavigationClient from './NavigationClient'

export default function NavigationBar() {
  // Estado local para los datos
  const [userRole, setUserRole] = useState<string | undefined>(undefined);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Llamamos a la Server Action desde el cliente
    const loadProfile = async () => {
      try {
        console.log("NAVBAR: Solicitando perfil al servidor...");
        const profile = await getCurrentUserProfile();

        if (profile) {
          console.log("NAVBAR: Perfil recibido:", profile);
          setUserRole(profile.role);
          // Si tu tabla profiles no tiene email, esto será undefined, pero no romperá nada
          setUserEmail(profile.email); 
        } else {
          console.warn("NAVBAR: Perfil es null");
        }
      } catch (error) {
        console.error("NAVBAR: Error al cargar perfil", error);
      }
    };

    loadProfile();
  }, []);

  // Renderizamos el cliente. 
  // Al ser Client Component, esto se dibuja INMEDIATAMENTE, 
  // por lo que las flechas y el cuadro negro deberían aparecer sí o sí.
  return (
    <NavigationClient 
      userRole={userRole} 
      userEmail={userEmail} 
    />
  )
}