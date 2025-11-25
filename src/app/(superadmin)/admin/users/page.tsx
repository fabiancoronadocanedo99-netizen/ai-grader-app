'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseClient'
import Link from 'next/link'
import { createUser } from '@/actions/user-actions'

// --- Tipos ---
interface Organization {
  id: string
  name: string
}

interface UserProfile {
  id: string
  full_name: string
  email: string // Asumimos que guardas el email en profiles, o lo traemos de auth
  role: string
  organization_id: string | null
  // Relación con organizaciones (Supabase devuelve esto como objeto o array)
  organizations: { name: string } | null
}

interface UserFormData {
  email: string
  password: string
  fullName: string
  role: string
  organizationId: string
}

export default function UsersManagementPage() {
  const supabase = createClient()

  // --- Estados ---
  const [users, setUsers] = useState<UserProfile[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Estado del Formulario
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    password: '',
    fullName: '',
    role: 'teacher', // Valor por defecto
    organizationId: ''
  })

  // --- 1. Cargar Datos ---
  const fetchData = async () => {
    try {
      setLoading(true)

      // A. Cargar Organizaciones (para el select)
      const { data: orgsData, error: orgsError } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name')

      if (orgsError) throw orgsError
      setOrganizations(orgsData || [])

      // B. Cargar Perfiles con nombre de Organización
      // Nota: 'organizations(name)' hace el join
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*, organizations(name)')
        .order('created_at', { ascending: false })

      if (usersError) throw usersError

      // Casteamos para asegurar el tipo, ya que Supabase devuelve tipos complejos en joins
      setUsers((usersData as unknown) as UserProfile[] || [])

    } catch (error) {
      console.error('Error al cargar datos:', error)
      alert('Error al cargar la lista de usuarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // --- 2. Manejo del Formulario ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validaciones básicas
    if (!formData.email || !formData.password || !formData.fullName) {
      alert('Por favor completa todos los campos obligatorios.')
      return
    }

    setIsSaving(true)

    try {
      // Llamada a la Server Action
      const result = await createUser(formData)

      if (!result.success) {
        throw new Error(result.error)
      }

      // Éxito
      alert('Usuario creado exitosamente')
      setIsModalOpen(false)
      setFormData({
        email: '',
        password: '',
        fullName: '',
        role: 'teacher',
        organizationId: ''
      })
      await fetchData() // Recargar lista

    } catch (error) {
      // Manejo de redirección de Next.js (edge case)
      if ((error as Error).message === 'NEXT_REDIRECT') {
        throw error;
      }
      console.error('Error creando usuario:', error)
      alert(`Error al crear usuario: ${(error as Error).message}`)
    } finally {
      setIsSaving(false)
    }
  }

  // --- Estilos Neumórficos ---
  const neuBase = "bg-[#e0e5ec] text-gray-700"
  const neuShadow = "shadow-[9px_9px_16px_rgb(163,177,198),-9px_-9px_16px_rgba(255,255,255,0.5)]"
  const neuInset = "shadow-[inset_6px_6px_10px_rgb(163,177,198),inset_-6px_-6px_10px_rgba(255,255,255,0.5)]"

  const neuCard = `${neuBase} ${neuShadow} rounded-2xl`
  const neuButton = `${neuBase} ${neuShadow} px-6 py-3 rounded-xl font-bold text-sm hover:translate-y-[2px] active:shadow-[inset_6px_6px_10px_rgb(163,177,198),inset_-6px_-6px_10px_rgba(255,255,255,0.5)] transition-all duration-200 text-blue-600`
  const neuInput = `${neuBase} ${neuInset} w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-400/50 transition-all border border-transparent focus:border-blue-300`

  return (
    <div className={`min-h-screen ${neuBase} p-8 font-sans`}>

      {/* --- Encabezado --- */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Usuarios</h1>
          <p className="text-gray-500 text-sm mt-1">Administra profesores, directores y admins</p>
        </div>

        <div className="flex gap-4">
            <Link href="/dashboard" className={`${neuButton} !text-gray-600`}>
                ← Volver
            </Link>
            <button 
              onClick={() => setIsModalOpen(true)}
              className={neuButton}
            >
              + Nuevo Usuario
            </button>
        </div>
      </header>

      {/* --- Contenido (Tabla Neumórfica) --- */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500"></div>
        </div>
      ) : users.length === 0 ? (
        <div className={`${neuCard} p-10 text-center flex flex-col items-center justify-center min-h-[300px]`}>
          <span className="text-6xl mb-4">👥</span>
          <h3 className="text-xl font-bold text-gray-600">No hay usuarios registrados</h3>
          <p className="text-gray-500 mt-2">Crea el primer usuario para comenzar.</p>
        </div>
      ) : (
        <div className={`${neuCard} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-500 text-sm border-b border-gray-300/30">
                  <th className="p-4 font-semibold">Nombre</th>
                  <th className="p-4 font-semibold">Email</th>
                  <th className="p-4 font-semibold">Rol</th>
                  <th className="p-4 font-semibold">Organización</th>
                  <th className="p-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-100/30 transition-colors border-b border-gray-300/20 last:border-0">
                    <td className="p-4 font-bold text-gray-700">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white font-bold text-xs">
                          {user.full_name?.charAt(0) || 'U'}
                        </div>
                        {user.full_name}
                      </div>
                    </td>
                    <td className="p-4 text-gray-600">{user.email}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold 
                        ${user.role === 'admin' ? 'bg-purple-100 text-purple-600' : 
                          user.role === 'director' ? 'bg-orange-100 text-orange-600' : 
                          'bg-blue-100 text-blue-600'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600">
                      {user.organizations?.name || <span className="text-gray-400 italic">Sin Asignar</span>}
                    </td>
                    <td className="p-4 text-right">
                      <button className="text-gray-400 hover:text-blue-600 transition-colors">
                        ✎
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Modal Crear Usuario --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className={`${neuCard} bg-[#e0e5ec] w-full max-w-lg p-8 relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto`}>

            <h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">Nuevo Usuario</h2>

            <form onSubmit={handleCreateUser} className="space-y-4">

              {/* Nombre */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase tracking-wide">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className={neuInput}
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase tracking-wide">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={neuInput}
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase tracking-wide">
                  Contraseña
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={neuInput}
                  required
                  minLength={6}
                />
              </div>

              {/* Rol */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase tracking-wide">
                  Rol
                </label>
                <div className="relative">
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className={`${neuInput} appearance-none bg-transparent cursor-pointer`}
                  >
                    <option value="teacher">Teacher (Profesor)</option>
                    <option value="admin">Admin (Administrador)</option>
                    <option value="director">Director</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                    ▼
                  </div>
                </div>
              </div>

              {/* Organización */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase tracking-wide">
                  Organización
                </label>
                <div className="relative">
                  <select
                    name="organizationId"
                    value={formData.organizationId}
                    onChange={handleInputChange}
                    className={`${neuInput} appearance-none bg-transparent cursor-pointer`}
                    required
                  >
                    <option value="">Selecciona una organización...</option>
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                    ▼
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-4 mt-8 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`${neuButton} flex-1 !text-gray-500`}
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`${neuButton} flex-1 !text-blue-600`}
                  disabled={isSaving}
                >
                  {isSaving ? 'Guardando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  )
}