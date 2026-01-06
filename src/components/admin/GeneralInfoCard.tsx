'use client'

import { useState } from 'react'
import { updateOrganizationDetails, uploadOrganizationLogo } from '@/actions/organization-actions'

interface GeneralInfoCardProps {
  initialData: any
}

export default function GeneralInfoCard({ initialData }: GeneralInfoCardProps) {
  const [name, setName] = useState(initialData.name || '')
  const [subdomain, setSubdomain] = useState(initialData.subdomain || '')
  const [logoFile, setLogoFile] = useState<File | null>(null)

  const [isUpdatingDetails, setIsUpdatingDetails] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)

  // Función para subir el logo
  const handleUploadLogo = async () => {
    if (!logoFile) return alert("Selecciona un archivo primero")

    setIsUploadingLogo(true)
    const formData = new FormData()
    formData.append('logo', logoFile)

    const res = await uploadOrganizationLogo(initialData.id, formData)
    setIsUploadingLogo(false)

    if (res.success) {
      alert("Logo actualizado correctamente")
      setLogoFile(null)
    } else {
      alert("Error al subir logo: " + res.error)
    }
  }

  // Función para guardar nombre y subdominio
  const handleUpdateDetails = async () => {
    setIsUpdatingDetails(true)
    const res = await updateOrganizationDetails(initialData.id, { name, subdomain })
    setIsUpdatingDetails(false)

    if (res.success) {
      alert("Datos actualizados correctamente")
    } else {
      alert("Error: " + res.error)
    }
  }

  const neuInset = "shadow-[inset_6px_6px_10px_rgb(163,177,198),inset_-6px_-6px_10px_rgba(255,255,255,0.5)]"
  const neuButton = "shadow-[9px_9px_16px_rgb(163,177,198),-9px_-9px_16px_rgba(255,255,255,0.5)] active:shadow-[inset_6px_6px_10px_rgb(163,177,198),inset_-6px_-6px_10px_rgba(255,255,255,0.5)]"

  return (
    <div className="p-8 bg-[#e0e5ec] rounded-[30px] shadow-[20px_20px_60px_#a3b1c6,-20px_-20px_60px_#ffffff] space-y-8">
      <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
        🏢 Información General
      </h2>

      {/* SECCIÓN DE LOGO */}
      <div className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-[#e0e5ec] shadow-[inset_4px_4px_8px_#a3b1c6,inset_-4px_-4px_8px_#ffffff]">
        <div className="relative w-24 h-24 rounded-full bg-[#e0e5ec] shadow-[6px_6px_12px_#a3b1c6,-6px_-6px_12px_#ffffff] overflow-hidden flex items-center justify-center">
          {initialData.logo_url ? (
            <img src={initialData.logo_url} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl">🏛️</span>
          )}
        </div>

        <div className="w-full space-y-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block text-center">Cambiar Logo</label>
          <input 
            type="file" 
            accept="image/*"
            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
            className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#e0e5ec] file:text-blue-600 file:shadow-[4px_4px_8px_#a3b1c6,-4px_-4px_8px_#ffffff] cursor-pointer"
          />
          <button
            onClick={handleUploadLogo}
            disabled={!logoFile || isUploadingLogo}
            className={`w-full py-2 rounded-xl bg-[#e0e5ec] text-xs font-bold text-blue-600 transition-all ${neuButton} disabled:opacity-50`}
          >
            {isUploadingLogo ? 'Subiendo...' : 'Subir Logo'}
          </button>
        </div>
      </div>

      {/* INPUTS DE TEXTO */}
      <div className="space-y-4">
        <div>
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2 block mb-2">Nombre de la Institución</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full p-4 rounded-xl bg-[#e0e5ec] outline-none text-gray-700 ${neuInset}`}
            placeholder="Ej. Colegio San Agustín"
          />
        </div>

        <div>
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2 block mb-2">Subdominio</label>
          <div className="relative flex items-center">
            <input
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/\s/g, ''))}
              className={`w-full p-4 rounded-xl bg-[#e0e5ec] outline-none text-gray-700 pr-32 ${neuInset}`}
              placeholder="colegio-agustin"
            />
            <span className="absolute right-4 text-xs font-bold text-gray-400">.tudominio.com</span>
          </div>
        </div>
      </div>

      {/* BOTÓN GUARDAR CAMBIOS */}
      <button
        onClick={handleUpdateDetails}
        disabled={isUpdatingDetails}
        className={`w-full py-4 rounded-2xl bg-[#e0e5ec] text-gray-700 font-bold transition-all ${neuButton} disabled:opacity-50`}
      >
        {isUpdatingDetails ? 'Guardando...' : 'Guardar Cambios'}
      </button>
    </div>
  )
}