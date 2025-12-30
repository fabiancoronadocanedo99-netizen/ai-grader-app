import { getCurrentUserProfile } from '@/actions/user-actions'
import NavigationClient from './NavigationClient'

export default async function NavigationBar() {
  // 1. Llamada a la Server Action (Server-side fetching)
  const profile = await getCurrentUserProfile()

  // 2. Extraer datos seguros para pasar al cliente
  // Nota: profile puede ser null si no hay sesión
  const userRole = profile?.role
  // profile.email no siempre existe en la tabla profiles dependiendo de tu trigger. 
  // Si no tienes columna email en profiles, puedes pasar null o modificar getCurrentUserProfile.
  // Asumiremos que el objeto profile trae lo que necesitamos o es null.
  const userEmail = profile?.email || undefined

  // 3. Renderizar el componente cliente con los datos
  return (
    <NavigationClient 
      userRole={userRole} 
      userEmail={userEmail} 
    />
  )
}