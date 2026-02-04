'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseClient' 
import Link from 'next/link'
import { createUser, getUsers, updateUser, deleteUser } from '@/actions/user-actions'
import { getOrganizations } from '@/actions/organization-actions'

// --- Tipos ---
interface Organization {
  id: string
  name: string
}

interface UserProfile {
  id: string
  full_name: string
  email: string
  role: string
  organization_id: string | null
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

  // Estados para edición
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)

  // Estado editFormData (Mantiene el ID para el servidor)
  const [editFormData, setEditFormData] = useState({
    id: '', 
    fullName: '',
    role: '',
    organizationId: ''
  })
  const [isUpdating, setIsUpdating] = useState(false)

  // Estados para eliminación
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Estado del Formulario de Creación
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    password: '',
    fullName: '',
    role: 'teacher',
    organizationId: ''
  })

  // --- 1. Cargar Datos ---
  const fetchData = async () => {
    try {
      setLoading(true)
      const [usersData, orgsData] = await Promise.all([
        getUsers(),
        getOrganizations()
      ])
      setUsers((usersData as unknown) as UserProfile[] || [])
      setOrganizations(orgsData || [])
    } catch (error) {
      console.error('Error al cargar datos:', error)
      alert('Error al cargar los datos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // --- 2. Manejo de Creación ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email || !formData.password || !formData.fullName) {
      alert('Completa los campos obligatorios.')
      return
    }
    setIsSaving(true)
    try {
      const result = await createUser(formData)
      if (!result.success) throw new Error(result.error)
      alert('Usuario creado exitosamente')
      setIsModalOpen(false)
      setFormData({ email: '', password: '', fullName: '', role: 'teacher', organizationId: '' })
      await fetchData() 
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  // --- 3. handleEditClick (ULTRA-PRECISA) ---
  const handleEditClick = (user: any) => {
    // LOG PARA TI: Ver el ID real en la consola antes de abrir el modal
    console.log("ID Real del usuario seleccionado:", user.id);

    setEditingUser(user);
    setEditFormData({
      id: user.id, // <-- Aquí es donde aseguramos que viaje el UUID real de Supabase
      fullName: user.full_name || '',
      role: user.role || 'teacher',
      organizationId: user.organization_id || ''
    });
    setIsEditModalOpen(true);
  };

  // --- 4. handleUpdateUser (Lógica de Guardado) ---
  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setEditFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()

    // Alert de prueba para confirmar que el ID sigue ahí al momento de enviar
    alert("Intentando actualizar ID: " + editFormData.id); 

    if (!editFormData.id) {
      alert("¡ERROR! El formulario no tiene el ID del usuario.");
      return;
    }

    if (!editFormData.fullName.trim()) {
      alert('El nombre es obligatorio.');
      return;
    }

    setIsUpdating(true)

    try {
      const result = await updateUser(editFormData.id, {
        fullName: editFormData.fullName,
        role: editFormData.role,
        organizationId: editFormData.organizationId
      })

      if (!result.success) throw new Error(result.error)

      alert('Usuario actualizado exitosamente')
      setIsEditModalOpen(false)
      setEditingUser(null)
      await fetchData()

    } catch (error: any) {
      console.error('Error actualizando:', error)
      alert(`Error al actualizar usuario: ${error.message}`)
    } finally {
      setIsUpdating(false)
    }
  }

  // --- 5. Eliminación ---
  const openDeleteModal = (user: UserProfile) => {
    setDeletingUser(user)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return
    setIsDeleting(true)
    try {
      const result = await deleteUser(deletingUser.id)
      if (!result.success) throw new Error(result.error)
      alert('Usuario eliminado exitosamente')
      setIsDeleteModalOpen(false)
      await fetchData()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  // Estilos Neumórficos
  const neuBase = "bg-[#e0e5ec] text-gray-700"
  const neuShadow = "shadow-[9px_9px_16px_rgb(163,177,198),-9px_-9px_16px_rgba(255,255,255,0.5)]"
  const neuInset = "shadow-[inset_6px_6px_10px_rgb(163,177,198),inset_-6px_-6px_10px_rgba(255,255,255,0.5)]"
  const neuCard = `${neuBase} ${neuShadow} rounded-2xl`
  const neuButton = `${neuBase} ${neuShadow} px-6 py-3 rounded-xl font-bold text-sm hover:translate-y-[2px] active:shadow-[inset_6px_6px_10px_rgb(163,177,198),inset_-6px_-6px_10px_rgba(255,255,255,0.5)] transition-all duration-200 text-blue-600`
  const neuInput = `${neuBase} ${neuInset} w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-400/50 transition-all border border-transparent focus:border-blue-300`
  const neuIconButton = `${neuBase} ${neuShadow} w-8 h-8 rounded-lg flex items-center justify-center hover:translate-y-[1px] active:shadow-[inset_4px_4px_8px_rgb(163,177,198),inset_-4px_-4px_8px_rgba(255,255,255,0.5)] transition-all duration-200`

  return (
    <div className={`min-h-screen ${neuBase} p-8 font-sans text-left`}>
      <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4 text-left">
        <div className="text-left w-full">
          <h1 className="text-3xl font-bold text-gray-800">Usuarios</h1>
          <p className="text-gray-500 text-sm mt-1">Administra profesores, directores y admins</p>
        </div>
        <div className="flex gap-4">
            <Link href="/dashboard" className={`${neuButton} !text-gray-600`}>← Volver</Link>
            <button onClick={() => setIsModalOpen(true)} className={neuButton}>+ Nuevo Usuario</button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500"></div>
        </div>
      ) : users.length === 0 ? (
        <div className={`${neuCard} p-10 text-center flex flex-col items-center justify-center min-h-[300px]`}>
          <span className="text-6xl mb-4">👥</span>
          <h3 className="text-xl font-bold text-gray-600">No hay usuarios registrados</h3>
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
                    <td className="p-4 uppercase text-[10px] font-black tracking-widest">
                      <span className={`px-2 py-1 rounded-md 
                        ${user.role === 'admin' ? 'bg-purple-100 text-purple-600' : 
                          user.role === 'director' ? 'bg-orange-100 text-orange-600' : 
                          'bg-blue-100 text-blue-600'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600 italic text-xs">
                      {user.organizations?.name || "Sin Asignar"}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button 
                          onClick={() => handleEditClick(user)} 
                          className={`${neuIconButton} text-blue-600`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>
                        <button onClick={() => openDeleteModal(user)} className={`${neuIconButton} text-red-600`}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Modal Crear --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 text-left">
          <div className={`${neuCard} bg-[#e0e5ec] w-full max-w-lg p-8 relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto`}>
            <h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">Nuevo Usuario</h2>
            <form onSubmit={handleCreateUser} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase tracking-wide">Nombre Completo</label>
                <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className={neuInput} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase tracking-wide">Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} className={neuInput} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase tracking-wide">Contraseña</label>
                <input type="password" name="password" value={formData.password} onChange={handleInputChange} className={neuInput} required minLength={6} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase tracking-wide">Rol</label>
                <div className="relative">
                  <select name="role" value={formData.role} onChange={handleInputChange} className={`${neuInput} appearance-none bg-transparent cursor-pointer`}>
                    <option value="teacher">Teacher (Profesor)</option>
                    <option value="admin">Admin (Administrador)</option>
                    <option value="director">Director</option>
                    <option value="institutional_manager">Gerente Institucional</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">▼</div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase tracking-wide">Organización</label>
                <div className="relative">
                  <select name="organizationId" value={formData.organizationId} onChange={handleInputChange} className={`${neuInput} appearance-none bg-transparent cursor-pointer`} required>
                    <option value="">Selecciona una organización...</option>
                    {organizations.map(org => (<option key={org.id} value={org.id}>{org.name}</option>))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">▼</div>
                </div>
              </div>
              <div className="flex gap-4 mt-8 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className={`${neuButton} flex-1 !text-gray-500`} disabled={isSaving}>Cancelar</button>
                <button type="submit" className={`${neuButton} flex-1 !text-blue-600`} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Crear Usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal Editar (USANDO handleUpdateUser) --- */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 text-left">
          <div className={`${neuCard} bg-[#e0e5ec] w-full max-w-lg p-8 relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto`}>
            <h2 className="text-2xl font-bold text-gray-700 mb-6 text-center">Editar Usuario</h2>
            <form onSubmit={handleUpdateUser} className="space-y-4 text-left">
              <input type="hidden" name="id" value={editFormData.id} />
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase tracking-wide">Nombre Completo</label>
                <input 
                  type="text" 
                  name="fullName" 
                  value={editFormData.fullName} 
                  onChange={handleEditInputChange} 
                  className={neuInput} 
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase tracking-wide">Rol</label>
                <div className="relative">
                  <select 
                    name="role" 
                    value={editFormData.role} 
                    onChange={handleEditInputChange} 
                    className={`${neuInput} appearance-none bg-transparent cursor-pointer`}
                  >
                    <option value="teacher">Teacher (Profesor)</option>
                    <option value="admin">Admin (Administrador)</option>
                    <option value="director">Director</option>
                    <option value="institutional_manager">Gerente Institucional</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">▼</div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase tracking-wide">Organización</label>
                <div className="relative">
                  <select 
                    name="organizationId" 
                    value={editFormData.organizationId} 
                    onChange={handleEditInputChange} 
                    className={`${neuInput} appearance-none bg-transparent cursor-pointer`} 
                    required
                  >
                    <option value="">Selecciona una organización...</option>
                    {organizations.map(org => (<option key={org.id} value={org.id}>{org.name}</option>))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">▼</div>
                </div>
              </div>
              <div className="flex gap-4 mt-8 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)} 
                  className={`${neuButton} flex-1 !text-gray-500`} 
                  disabled={isUpdating}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className={`${neuButton} flex-1 !text-blue-600`} 
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal Eliminar --- */}
      {isDeleteModalOpen && deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 text-left">
          <div className={`${neuCard} bg-[#e0e5ec] w-full max-w-md p-8 relative text-center`}>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-red-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-700 mb-2">¿Eliminar Usuario?</h2>
            <p className="text-gray-600 mb-8 text-center">
                Esta acción es permanente para <strong>{deletingUser.full_name}</strong>.
            </p>
            <div className="flex gap-4">
              <button onClick={() => setIsDeleteModalOpen(false)} className={`${neuButton} flex-1 !text-gray-500`} disabled={isDeleting}>Cancelar</button>
              <button onClick={handleDeleteUser} className={`${neuButton} flex-1 !text-red-600`} disabled={isDeleting}>
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}