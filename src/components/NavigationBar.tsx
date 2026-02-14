import { getCurrentUserProfile } from '@/actions/user-actions'
import NavigationClient from './NavigationClient'

export default async function NavigationBar() {
  // El servidor obtiene el perfil directamente de las cookies
  // sin esperar a que el navegador cargue.
  const profile = await getCurrentUserProfile()

  const userRole = profile?.role
  const userEmail = profile?.email || undefined

  return (
    <NavigationClient 
      userRole={userRole} 
      userEmail={userEmail} 
    />
  )
}