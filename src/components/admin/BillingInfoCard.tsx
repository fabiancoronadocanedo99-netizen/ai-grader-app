'use client'

import { useState } from 'react'
import { updateOrganizationDetails, generatePreInvoice } from '@/actions/organization-actions'

interface BillingInfoCardProps {
  initialData: any
}

export default function BillingInfoCard({ initialData }: BillingInfoCardProps) {
  const [loading, setLoading] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  // Estados para cada campo
  const [billingName, setBillingName] = useState(initialData.billing_name || '')
  const [billingAddress, setBillingAddress] = useState(initialData.billing_address || '')
  const [taxId, setTaxId] = useState(initialData.tax_id || '')

  const handleUpdate = async () => {
    setLoading(true)
    const res = await updateOrganizationDetails(initialData.id, {
      billing_name: billingName,
      billing_address: billingAddress,
      tax_id: taxId
    })
    setLoading(false)

    if (res.success) alert("Datos fiscales actualizados correctamente")
    else alert("Error al actualizar: " + res.error)
  }

  const handleSendPreInvoice = async () => {
    setSendingEmail(true)
    const res = await generatePreInvoice(initialData.id)
    setSendingEmail(false)

    if (res.success) alert("Email de pre-factura enviado al contacto financiero")
    else alert("Error al enviar email: " + res.error)
  }

  const neuInset = "shadow-[inset_6px_6px_10px_rgb(163,177,198),inset_-6px_-6px_10px_rgba(255,255,255,0.5)]"
  const neuButton = "shadow-[9px_9px_16px_rgb(163,177,198),-9px_-9px_16px_rgba(255,255,255,0.5)] active:shadow-[inset_6px_6px_10px_rgb(163,177,198),inset_-6px_-6px_10px_rgba(255,255,255,0.5)]"

  return (
    <div className="p-8 bg-[#e0e5ec] rounded-[30px] shadow-[20px_20px_60px_#a3b1c6,-20px_-20px_60px_#ffffff] space-y-6">
      <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
        💳 Datos de Facturación
      </h2>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2 block mb-2">Razón Social</label>
          <input
            value={billingName}
            onChange={(e) => setBillingName(e.target.value)}
            placeholder="Nombre legal de la institución"
            className={`w-full p-4 rounded-xl bg-[#e0e5ec] outline-none text-gray-700 ${neuInset}`}
          />
        </div>

        <div>
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2 block mb-2">RFC / Tax ID</label>
          <input
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder="Ej. ABC123456XYZ"
            className={`w-full p-4 rounded-xl bg-[#e0e5ec] outline-none text-gray-700 ${neuInset}`}
          />
        </div>

        <div>
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2 block mb-2">Dirección Fiscal</label>
          <textarea
            value={billingAddress}
            onChange={(e) => setBillingAddress(e.target.value)}
            rows={3}
            placeholder="Calle, Número, Colonia, CP"
            className={`w-full p-4 rounded-xl bg-[#e0e5ec] outline-none text-gray-700 resize-none ${neuInset}`}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 pt-2">
        <button
          onClick={handleUpdate}
          disabled={loading}
          className={`flex-1 py-4 rounded-2xl bg-[#e0e5ec] text-gray-700 font-bold transition-all ${neuButton} disabled:opacity-50`}
        >
          {loading ? "Guardando..." : "Guardar Datos"}
        </button>

        <button
          onClick={handleSendPreInvoice}
          disabled={sendingEmail}
          className={`flex-1 py-4 rounded-2xl bg-[#e0e5ec] text-blue-600 font-bold transition-all ${neuButton} disabled:opacity-50`}
        >
          {sendingEmail ? "Enviando..." : "📧 Enviar Pre-Factura"}
        </button>
      </div>
    </div>
  )
}