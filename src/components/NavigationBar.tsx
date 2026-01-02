'use client'

import { useEffect, useState } from 'react'
import { getCurrentUserProfile } from '@/actions/user-actions'
import NavigationClient from './NavigationClient'

export default function NavigationBar() {
  const [userRole, setUserRole] = useState<string | undefined>(undefined);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await getCurrentUserProfile();

        if (profile) {
          setUserRole(profile.role);
          setUserEmail(profile.email); 
        }
      } catch (error) {
        // Fallo silencioso en producción para no molestar al usuario
        console.error("Error cargando perfil:", error); 
      }
    };

    loadProfile();
  }, []);

  return (
    <NavigationClient 
      userRole={userRole} 
      userEmail={userEmail} 
    />
  )
}