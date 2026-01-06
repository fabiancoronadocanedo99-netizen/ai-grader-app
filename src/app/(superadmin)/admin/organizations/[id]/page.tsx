// src/app/(superadmin)/admin/organizations/[id]/page.tsx

import { getOrganizationDetails } from "@/actions/organization-actions"
import { notFound } from "next/navigation"
import Link from "next/link"

// Importaciones de todos los componentes de la sección
import UsageAnalytics from '@/components/admin/UsageAnalytics'
import UserList from '@/components/admin/UserList'
import GeneralInfoCard from '@/components/admin/GeneralInfoCard'
import SubscriptionCard from '@/components/admin/SubscriptionCard'
import ContactInfoCard from '@/components/admin/ContactInfoCard'
import BillingInfoCard from '@/components/admin/BillingInfoCard'

interface PageProps {
  params: { id: string };
}

export default async function OrganizationDetailPage({ params }: PageProps) {
  const { id } = params;

  // Obtenemos los datos de la organización y sus usuarios
  const { organization, users, error } = await getOrganizationDetails(id)

  if (error || !organization) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-[#e0e5ec] p-8 font-sans">
      <div className="max-w-7xl mx-auto">

        {/* Encabezado Neumórfico */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
          <div>
            <div className="flex items-center gap-4">
              <Link 
                href="/admin/organizations" 
                className="w-10 h-10 rounded-full bg-[#e0e5ec] shadow-[6px_6px_12px_#a3b1c6,-6px_-6px_12px_#ffffff] flex items-center justify-center text-gray-600 hover:text-blue-600 transition-all"
              >
                ←
              </Link>
              <h1 className="text-3xl font-bold text-gray-800">{organization.name}</h1>
            </div>
            <p className="text-gray-500 text-sm mt-2 ml-14">
              Panel administrativo de la institución
            </p>
          </div>

          <div className="px-6 py-2 rounded-full bg-[#e0e5ec] shadow-[inset_4px_4px_8px_#a3b1c6,inset_-4px_-4px_8px_#ffffff] text-xs font-mono text-gray-500">
            ID: {organization.id}
          </div>
        </header>

        {/* Layout de Rejilla */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* COLUMNA IZQUIERDA (Principal) - Analíticas y Usuarios */}
          <div className="lg:col-span-2 space-y-8">
            <UsageAnalytics organizationId={organization.id} />
            <UserList users={users || []} />
          </div>

          {/* COLUMNA DERECHA (Configuración) - Cards de gestión */}
          <div className="space-y-8">
            {/* Información básica */}
            <GeneralInfoCard initialData={organization} />

            {/* Plan y créditos */}
            <SubscriptionCard initialData={organization} />

            {/* Contactos (Director y Finanzas) */}
            <ContactInfoCard initialData={organization} />

            {/* Datos fiscales y Facturación */}
            <BillingInfoCard initialData={organization} />
          </div>

        </div>

        {/* Footer simple */}
        <footer className="mt-12 text-center text-gray-400 text-xs pb-8">
          Creado el {new Date(organization.created_at).toLocaleDateString()} • Sistema de Gestión de Organizaciones
        </footer>
      </div>
    </div>
  )
}