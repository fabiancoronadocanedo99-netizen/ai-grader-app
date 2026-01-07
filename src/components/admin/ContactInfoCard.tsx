'use client'

import { useState } from 'react'
import { updateOrganizationDetails } from '@/actions/organization-actions'

interface ContactInfoCardProps {
  initialData: any
}

export default function ContactInfoCard({ initialData }: ContactInfoCardProps) {
  const [loading, setLoading] = useState(false)

  // Estados individuales para cada campo de contacto
  const [directorName, setDirectorName] = useState(initialData.director_name || '')
  const [directorEmail, setDirectorEmail] = useState(initialData.director_email || '')
  const [financeName, setFinanceName] = useState(initialData.finance_contact_name || '')
  const [financeEmail, setFinanceEmail] = useState(initialData.finance_contact_email || '')

  const handleUpdate = async () => {
    setLoading(true)
    const res = await updateOrganizationDetails(initialData.id, {
      director_name: directorName,
      director_email: directorEmail,
      finance_contact_name: financeName,
      finance_contact_email: financeEmail
    })
    setLoading(false)

    if (res.success) alert("Contactos actualizados con éxito")
    else alert("Error al actualizar contactos: " + res.error)
  }

  const neuInset = "shadow-[inset_6px_6px_10px_rgb(163,177,198),inset_-6px_-6px_10px_rgba(255,255,255,0.5)]"
  const neuButton = "shadow-[9px_9px_16px_rgb(163,177,198),-9px_-9px_16px_rgba(255,255,255,0.5)] active:shadow-[inset_6px_6px_10px_rgb(163,177,198),inset_-6px_-6px_10px_rgba(255,255,255,0.5)]"

  return (
    <div className="p-8 bg-[#e0e5ec] rounded-[30px] shadow-[20px_20px_60px_#a3b1c6,-20px_-20px_60px_#ffffff] space-y-8">
      <h2 className="text-xl font-bold text-gray-700 mb-2 flex items-center gap-2">
        📇 Directorio de Contacto
      </h2>

      {/* Sección Director */}
      <div className="space-y-4">
        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-2">Director General</p>
        <div className="grid grid-cols-1 gap-4">
          <input
            value={directorName}
            onChange={(e) => setDirectorName(e.target.value)}
            placeholder="Nombre completo"
            className={`w-full p-4 rounded-xl bg-[#e0e5ec] outline-none text-gray-700 ${neuInset}`}
          />
          <input
            value={directorEmail}
            onChange={(e) => setDirectorEmail(e.target.value)}
            placeholder="Correo electrónico institucional"
            className={`w-full p-4 rounded-xl bg-[#e0e5ec] outline-none text-gray-700 ${neuInset}`}
          />
        </div>
      </div>

      {/* Sección Finanzas */}
      <div className="space-y-4">
        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-2">Contacto de Finanzas / Pagos</p>
        <div className="grid grid-cols-1 gap-4">
          <input
            value={financeName}
            onChange={(e) => setFinanceName(e.target.value)}
            placeholder="Nombre del responsable"
            className={`w-full p-4 rounded-xl bg-[#e0e5ec] outline-none text-gray-700 ${neuInset}`}
          />
          <input
            value={financeEmail}
            onChange={(e) => setFinanceEmail(e.target.value)}
            placeholder="Correo para envío de facturas"
            className={`w-full p-4 rounded-xl bg-[#e0e5ec] outline-none text-gray-700 ${neuInset}`}
          />
        </div>
      </div>

      <button
        onClick={handleUpdate}
        disabled={loading}
        className={`w-full py-4 rounded-2xl bg-[#e0e5ec] text-gray-700 font-bold transition-all ${neuButton} disabled:opacity-50`}
      >
        {loading ? "Guardando cambios..." : "Actualizar Directorio"}
      </button>
    </div>
  )
}