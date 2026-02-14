import { getCurrentUserProfile } from '@/actions/user-actions'
import NavigationClient from './NavigationClient'

export default async function NavigationBar() {
  // El servidor hace el trabajo pesado: obtiene la sesión y el perfil
  // de forma asíncrona antes de renderizar nada en el cliente.
  const profile = await getCurrentUserProfile()

  // Enviamos los datos esenciales al 'NavigationClient'.
  // He añadido el userId por si lo necesitas para lógicas internas o depuración.
  return (
    <NavigationClient 
      userRole={profile?.role || undefined} 
      userEmail={profile?.email || undefined}
      userId={profile?.id || undefined}
    />
  )
}