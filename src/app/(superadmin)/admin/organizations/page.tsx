'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createOrganization, getOrganizations, updateOrganization, deleteOrganization } from '@/actions/organization-actions'

// --- Tipos ---
interface Organization {
  id: string
  name: string
  logo_url?: string | null
  created_at: string
  subscription_plan?: string | null
  credits_per_period?: number | null
  credits_remaining?: number | null
  next_renewal_date?: string | null
}

export default function OrganizationsManagementPage() {
  // Estados
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Estado para el formulario de creación
  const [newOrgName, setNewOrgName] = useState('')
  const [creating, setCreating] = useState(false)

  // Estados para edición
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
feature/credit-system
  const [editFormData, setEditFormData] = useState({
    name: '',
    subscription_plan: '',
    credits_per_period: 0,
    credits_remaining: 0,
    next_renewal_date: ''
  })

  const [editOrgName, setEditOrgName] = useState('')
main
  const [updating, setUpdating] = useState(false)

  // Estados para eliminación
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null)
  const [deleting, setDeleting] = useState(false)

  // --- 1. Cargar Datos (USANDO SERVER ACTION) ---
  const fetchOrganizations = async () => {
    try {
      setLoading(true)
      const data = await getOrganizations()
      console.log("✅ Organizaciones cargadas:", data?.length)
      setOrganizations((data as unknown) as Organization[] || [])
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
      const result = await createOrganization(newOrgName)

      if (!result.success) {
        throw new Error(result.error)
      }

      alert('Organización creada exitosamente')
      setNewOrgName('')
      setIsModalOpen(false)
      await fetchOrganizations()

    } catch (error) {
      if ((error as Error).message === 'NEXT_REDIRECT') {
        throw error;
      }
      alert(`Error al crear la organización: ${(error as Error).message}`)
    } finally {
      setCreating(false)
    }
  }

  // --- 3. Editar Organización ---
  const openEditModal = (org: Organization) => {
    setEditingOrg(org)
feature/credit-system
    setEditFormData({
      name: org.name,
      subscription_plan: org.subscription_plan || '',
      credits_per_period: org.credits_per_period || 0,
      credits_remaining: org.credits_remaining || 0,
      next_renewal_date: org.next_renewal_date ? org.next_renewal_date.split('T')[0] : ''
    })
    setIsEditModalOpen(true)
  }

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setEditFormData(prev => ({
      ...prev,
      [name]: name.includes('credits') ? parseInt(value) || 0 : value
    }))
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOrg || !editFormData.name.trim()) return
    setEditOrgName(org.name)
    setIsEditModalOpen(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editOrgName.trim() || !editingOrg) return
 main

    setUpdating(true)

    try {
feature/credit-system
      const result = await updateOrganization(editingOrg.id, {
        name: editFormData.name,
        subscription_plan: editFormData.subscription_plan,
        credits_per_period: editFormData.credits_per_period,
        credits_remaining: editFormData.credits_remaining,
        next_renewal_date: editFormData.next_renewal_date || undefined
      })

      const result = await updateOrganization(editingOrg.id, editOrgName)
main

      if (!result.success) {
        throw new Error(result.error)
      }

      alert('Organización actualizada exitosamente')
      setIsEditModalOpen(false)
      setEditingOrg(null)
feature/credit-system

      setEditOrgName('')
main
      await fetchOrganizations()

    } catch (error) {
      if ((error as Error).message === 'NEXT_REDIRECT') {
        throw error;
      }
      alert(`Error al actualizar la organización: ${(error as Error).message}`)
    } finally {
      setUpdating(false)
    }
  }

  // --- 4. Eliminar Organización ---
  const openDeleteModal = (org: Organization) => {
    setDeletingOrg(org)
    setIsDeleteModalOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingOrg) return

    setDeleting(true)

    try {
      const result = await deleteOrganization(deletingOrg.id)

      if (!result.success) {
        throw new Error(result.error)
      }

      alert('Organización eliminada exitosamente')
      setIsDeleteModalOpen(false)
      setDeletingOrg(null)
      await fetchOrganizations()

    } catch (error) {
      if ((error as Error).message === 'NEXT_REDIRECT') {
        throw error;
      }
      alert(`Error al eliminar la organización: ${(error as Error).message}`)
    } finally {
      setDeleting(false)
    }
  }

 feature/credit-system
  // --- Estilos Neumórficos ---

  // --- Estilos Neumórficos (Reutilizables) ---
 main
  const neuBase = "bg-[#e0e5ec] text-gray-700"
  const neuShadow = "shadow-[9px_9px_16px_rgb(163,177,198),-9px_-9px_16px_rgba(255,255,255,0.5)]"
  const neuInset = "shadow-[inset_6px_6px_10px_rgb(163,177,198),inset_-6px_-6px_10px_rgba(255,255,255,0.5)]"

  const neuCard = `${neuBase} ${neuShadow} rounded-2xl`
  const neuButton = `${neuBase} ${neuShadow} px-6 py-3 rounded-xl font-bold text-sm hover:translate-y-[2px] active:shadow-[inset_6px_6px_10px_rgb(163,177,198),inset_-6px_-6px_10px_rgba(255,255,255,0.5)] transition-all duration-200 text-blue-600`
  const neuInput = `${neuBase} ${neuInset} w-full p-4 rounded-xl outline-none focus:ring-2 focus:ring-blue-400/50 transition-all`
  const neuIconButton = `${neuBase} ${neuShadow} w-10 h-10 rounded-lg flex items-center justify-center hover:translate-y-[1px] active:shadow-[inset_4px_4px_8px_rgb(163,177,198),inset_-4px_-4px_8px_rgba(255,255,255,0.5)] transition-all duration-200`

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
                <p className="text-xs text-gray-500 mb-3">
                  Creada el: {new Date(org.created_at).toLocaleDateString()}
                </p>

                {/* Información de Créditos */}
                <div className={`${neuInset} p-3 rounded-lg space-y-2 mb-3`}>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 font-semibold">Plan:</span>
                    <span className={`px-2 py-1 rounded-full font-bold ${
                      org.subscription_plan === 'enterprise' ? 'bg-purple-100 text-purple-600' :
                      org.subscription_plan === 'pro' ? 'bg-blue-100 text-blue-600' :
                      org.subscription_plan === 'basic' ? 'bg-green-100 text-green-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {org.subscription_plan || 'Sin plan'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 font-semibold">Créditos:</span>
                    <span className={`font-bold ${
                      (org.credits_remaining || 0) > 50 ? 'text-green-600' :
                      (org.credits_remaining || 0) > 10 ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {org.credits_remaining || 0} / {org.credits_per_period || 0}
                    </span>
                  </div>
                  {org.next_renewal_date && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-semibold">Renovación:</span>
                      <span className="text-gray-600">
                        {new Date(org.next_renewal_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

 feature/credit-system
              <div className="mt-4 pt-4 border-t border-gray-300/30 flex justify-between items-center">
              <div className="mt-6 pt-4 border-t border-gray-300/30 flex justify-between items-center">
 main
                  <div className="flex gap-2">
                    {/* Botón Editar */}
                    <button 
                      onClick={() => openEditModal(org)}
                      className={`${neuIconButton} text-blue-600 hover:text-blue-700`}
                      title="Editar organización"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                      </svg>
                    </button>

                    {/* Botón Eliminar */}
                    <button 
                      onClick={() => openDeleteModal(org)}
                      className={`${neuIconButton} text-red-600 hover:text-red-700`}
                      title="Eliminar organización"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>

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

      {/* --- Modal Editar Organización --- */}
      {isEditModalOpen && editingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
 feature/credit-system
          <div className={`${neuCard} bg-[#e0e5ec] w-full max-w-lg p-8 relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto`}>

            <h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">Editar Organización</h2>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 ml-1 uppercase tracking-wide">

          <div className={`${neuCard} bg-[#e0e5ec] w-full max-w-md p-8 relative animate-in fade-in zoom-in duration-200`}>

            <h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">Editar Organización</h2>

            <form onSubmit={handleUpdate}>
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-600 mb-2 ml-1">
 main
                  Nombre de la Institución
                </label>
                <input
                  type="text"
feature/credit-system
                  name="name"
                  value={editFormData.name}
                  onChange={handleEditInputChange}
                  placeholder="Ej. Colegio San Agustín"
                  className={neuInput}
                  value={editOrgName}
                  onChange={(e) => setEditOrgName(e.target.value)}
                  placeholder="Ej. Colegio San Agustín"
                  className={neuInput}
                  autoFocus
 main
                  required
                />
              </div>

 feature/credit-system
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 ml-1 uppercase tracking-wide">
                  Plan de Suscripción
                </label>
                <div className="relative">
                  <select
                    name="subscription_plan"
                    value={editFormData.subscription_plan}
                    onChange={handleEditInputChange}
                    className={`${neuInput} appearance-none cursor-pointer`}
                  >
                    <option value="">Sin plan</option>
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">▼</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2 ml-1 uppercase tracking-wide">
                    Créditos por Periodo
                  </label>
                  <input
                    type="number"
                    name="credits_per_period"
                    value={editFormData.credits_per_period}
                    onChange={handleEditInputChange}
                    min="0"
                    className={neuInput}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2 ml-1 uppercase tracking-wide">
                    Créditos Restantes
                  </label>
                  <input
                    type="number"
                    name="credits_remaining"
                    value={editFormData.credits_remaining}
                    onChange={handleEditInputChange}
                    min="0"
                    className={neuInput}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 ml-1 uppercase tracking-wide">
                  Fecha de Renovación
                </label>
                <input
                  type="date"
                  name="next_renewal_date"
                  value={editFormData.next_renewal_date}
                  onChange={handleEditInputChange}
                  className={neuInput}
                />
              </div>

              <div className="flex gap-4 mt-8 pt-4">
              <div className="flex gap-4 mt-8">
main
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false)
                    setEditingOrg(null)
 feature/credit-system

                    setEditOrgName('')
 main
                  }}
                  className={`${neuButton} flex-1 !text-gray-500`}
                  disabled={updating}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`${neuButton} flex-1 !text-blue-600`}
 feature/credit-system
                  disabled={updating}
                  disabled={updating || !editOrgName.trim()}
main
                >
                  {updating ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* --- Modal Eliminar Organización --- */}
      {isDeleteModalOpen && deletingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className={`${neuCard} bg-[#e0e5ec] w-full max-w-md p-8 relative animate-in fade-in zoom-in duration-200`}>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-red-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-700 mb-2">¿Eliminar Organización?</h2>
              <p className="text-gray-600">
                ¿Estás seguro de que quieres eliminar <strong className="text-gray-800">{deletingOrg.name}</strong>?
              </p>
              <p className="text-sm text-red-600 mt-2">
                Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false)
                  setDeletingOrg(null)
                }}
                className={`${neuButton} flex-1 !text-gray-500`}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className={`${neuButton} flex-1 !text-red-600`}
                disabled={deleting}
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}