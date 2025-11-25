'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseClient'
import Link from 'next/link'
import { createOrganization } from '@/actions/organization-actions'

// --- Tipos ---
interface Organization {
  id: string
  name: string
  logo_url?: string | null
  created_at: string
}

export default function OrganizationsManagementPage() {
  const supabase = createClient()

  // Estados
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Estado para el formulario
  const [newOrgName, setNewOrgName] = useState('')
  const [creating, setCreating] = useState(false)

  // --- 1. Cargar Datos ---
  const fetchOrganizations = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrganizations(data || [])
    } catch (error) {
      console.error('Error al cargar organizaciones:', error)
      alert('Error al cargar la lista de organizaciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrganizations()
  }, [])

  // --- 2. Crear Organización ---
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOrgName.trim()) return

    setCreating(true)

    try {
      // LLAMAMOS A LA SERVER ACTION
      const result = await createOrganization(newOrgName)

      if (!result.success) {
        throw new Error(result.error)
      }

      // Éxito
      alert('Organización creada exitosamente')
      setNewOrgName('')
      setIsModalOpen(false)
      await fetchOrganizations() // Recargar la lista localmente

    } catch (error) {
      // Si es una redirección de Next.js, la dejamos pasar (es éxito)
      if ((error as Error).message === 'NEXT_REDIRECT') {
        throw error;
      }
      // Si es otro error real, mostramos el alert
      alert(`Error al crear la organización: ${(error as Error).message}`)
    } finally {
      setCreating(false)
    }
  }

  // --- Estilos Neumórficos (Reutilizables) ---
  const neuBase = "bg-[#e0e5ec] text-gray-700"
  const neuShadow = "shadow-[9px_9px_16px_rgb(163,177,198),-9px_-9px_16px_rgba(255,255,255,0.5)]"
  const neuInset = "shadow-[inset_6px_6px_10px_rgb(163,177,198),inset_-6px_-6px_10px_rgba(255,255,255,0.5)]"

  const neuCard = `${neuBase} ${neuShadow} rounded-2xl`
  const neuButton = `${neuBase} ${neuShadow} px-6 py-3 rounded-xl font-bold text-sm hover:translate-y-[2px] active:shadow-[inset_6px_6px_10px_rgb(163,177,198),inset_-6px_-6px_10px_rgba(255,255,255,0.5)] transition-all duration-200 text-blue-600`
  const neuInput = `${neuBase} ${neuInset} w-full p-4 rounded-xl outline-none focus:ring-2 focus:ring-blue-400/50 transition-all`

  return (
    <div className={`min-h-screen ${neuBase} p-8 font-sans`}>

      {/* --- Encabezado --- */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Organizaciones</h1>
          <p className="text-gray-500 text-sm mt-1">Gestiona las escuelas e instituciones registradas</p>
        </div>

        <div className="flex gap-4">
            <Link href="/dashboard" className={`${neuButton} !text-gray-600`}>
                ← Volver
            </Link>
            <button 
            onClick={() => setIsModalOpen(true)}
            className={neuButton}
            >
            + Nueva Organización
            </button>
        </div>
      </header>

      {/* --- Contenido --- */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500"></div>
        </div>
      ) : organizations.length === 0 ? (
        <div className={`${neuCard} p-10 text-center flex flex-col items-center justify-center min-h-[300px]`}>
          <span className="text-6xl mb-4">🏢</span>
          <h3 className="text-xl font-bold text-gray-600">No hay organizaciones aún</h3>
          <p className="text-gray-500 mt-2 mb-6">Comienza creando la primera institución.</p>
          <button onClick={() => setIsModalOpen(true)} className={neuButton}>
            Crear Primera Organización
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {organizations.map((org) => (
            <div key={org.id} className={`${neuCard} p-6 flex flex-col justify-between group hover:scale-[1.01] transition-transform duration-300`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`${neuCard} w-12 h-12 flex items-center justify-center rounded-full text-xl`}>
                  {org.logo_url ? (
                    <img src={org.logo_url} alt="logo" className="w-8 h-8 object-contain" />
                  ) : (
                    <span>🏛️</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 font-mono">
                    ID: {org.id.slice(0, 8)}...
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">{org.name}</h3>
                <p className="text-xs text-gray-500">
                  Creada el: {new Date(org.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-300/30 flex justify-end">
                  <button className={`${neuButton} !py-2 !px-4 text-xs !text-gray-600`}>
                      Ver Detalles
                  </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- Modal Nueva Organización --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className={`${neuCard} bg-[#e0e5ec] w-full max-w-md p-8 relative animate-in fade-in zoom-in duration-200`}>

            <h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">Nueva Organización</h2>

            <form onSubmit={handleCreate}>
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-600 mb-2 ml-1">
                  Nombre de la Institución
                </label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Ej. Colegio San Agustín"
                  className={neuInput}
                  autoFocus
                  required
                />
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`${neuButton} flex-1 !text-gray-500`}
                  disabled={creating}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`${neuButton} flex-1 !text-blue-600`}
                  disabled={creating || !newOrgName.trim()}
                >
                  {creating ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  )
}