'use client'

import { useState } from 'react'
import { updateOrganizationDetails } from '@/actions/organization-actions'

interface ContactInfoCardProps {
  initialData: any
}

export default function ContactInfoCard({ initialData }: ContactInfoCardProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    director_name: initialData.director_name || '',
    director_email: initialData.director_email || '',
    finance_contact_name: initialData.finance_contact_name || '',
    finance_contact_email: initialData.finance_contact_email || '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleUpdate = async () => {
    setLoading(true)
    const res = await updateOrganizationDetails(initialData.id, formData)
    setLoading(false)
    if (res.success) alert("Contactos actualizados")
    else alert("Error: " + res.error)
  }

  const neuInset = "shadow-[inset_6px_6px_10px_rgb(163,177,198),inset_-6px_-6px_10px_rgba(255,255,255,0.5)]"
  const neuButton = "shadow-[9px_9px_16px_rgb(163,177,198),-9px_-9px_16px_rgba(255,255,255,0.5)] active:shadow-[inset_6px_6px_10px_rgb(163,177,198),inset_-6px_-6px_10px_rgba(255,255,255,0.5)]"

  return (
    <div className="p-8 bg-[#e0e5ec] rounded-[30px] shadow-[20px_20px_60px_#a3b1c6,-20px_-20px_60px_#ffffff] space-y-6">
      <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
        📇 Información de Contacto
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Director General</p>
          <input
            name="director_name"
            value={formData.director_name}
            onChange={handleChange}
            placeholder="Nombre del Director"
            className={`w-full p-4 rounded-xl bg-[#e0e5ec] outline-none text-gray-700 ${neuInset}`}
          />
          <input
            name="director_email"
            value={formData.director_email}
            onChange={handleChange}
            placeholder="Email del Director"
            className={`w-full p-4 rounded-xl bg-[#e0e5ec] outline-none text-gray-700 ${neuInset}`}
          />
        </div>

        <div className="space-y-4">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Contacto Administrativo</p>
          <input
            name="finance_contact_name"
            value={formData.finance_contact_name}
            onChange={handleChange}
            placeholder="Nombre Finanzas"
            className={`w-full p-4 rounded-xl bg-[#e0e5ec] outline-none text-gray-700 ${neuInset}`}
          />
          <input
            name="finance_contact_email"
            value={formData.finance_contact_email}
            onChange={handleChange}
            placeholder="Email Finanzas"
            className={`w-full p-4 rounded-xl bg-[#e0e5ec] outline-none text-gray-700 ${neuInset}`}
          />
        </div>
      </div>

      <button
        onClick={handleUpdate}
        disabled={loading}
        className={`w-full py-4 rounded-2xl bg-[#e0e5ec] text-blue-600 font-bold transition-all ${neuButton} disabled:opacity-50`}
      >
        {loading ? "Guardando..." : "Guardar Contactos"}
      </button>
    </div>
  )
}