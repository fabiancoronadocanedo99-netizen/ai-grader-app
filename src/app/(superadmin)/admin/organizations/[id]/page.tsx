import { getOrganizationDetails } from "@/actions/organization-actions"
import { notFound } from "next/navigation"

// Importaciones con rutas absolutas
import UsageAnalytics from '@/components/admin/UsageAnalytics'
import UserList from '@/components/admin/UserList'
import GeneralInfoCard from '@/components/admin/GeneralInfoCard'
import SubscriptionCard from '@/components/admin/SubscriptionCard'

interface PageProps {
  params: { id: string };
}

export default async function OrganizationDetailPage({ params }: PageProps) {
  // En Next.js 14 accedemos directamente a params
  const { id } = params;

  const { organization, users, error } = await getOrganizationDetails(id)

  // Si no existe la organización o hay un error de base de datos
  if (error || !organization) {
    notFound()
  }

  return (
    <main className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{organization.name}</h1>
        <p className="text-muted-foreground">
          Configuración detallada, gestión de usuarios y métricas de consumo.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Principal: Analíticas y Usuarios */}
        <div className="lg:col-span-2 space-y-6">
          <UsageAnalytics organizationId={organization.id} />
          <UserList users={users || []} />
        </div>

        {/* Columna Lateral: Información y Suscripción */}
        <div className="space-y-6">
          <GeneralInfoCard initialData={organization} />
          <SubscriptionCard initialData={organization} />
        </div>
      </div>
    </main>
  )
}