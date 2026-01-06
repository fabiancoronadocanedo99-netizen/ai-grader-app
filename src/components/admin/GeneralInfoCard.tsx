'use client'
import { useState } from 'react'
import { updateOrganizationDetails } from '@/actions/organization-actions'

export default function GeneralInfoCard({ initialData }: { initialData: any }) {
  const [name, setName] = useState(initialData.name);

  return (
    <div className="p-8 bg-[#f0f2f5] rounded-[30px] shadow-[20px_20px_60px_#bebebe,-20px_-20px_60px_#ffffff] space-y-6">
      <h2 className="text-lg font-bold text-slate-700">Información General</h2>

      <div>
        <label className="text-xs font-bold text-slate-500 ml-2 mb-2 block uppercase">Nombre de Institución</label>
        <input 
          className="w-full p-4 rounded-[15px] bg-[#f0f2f5] shadow-[inset_6px_6px_12px_#d1d1d1,inset_-6px_-6px_12px_#ffffff] outline-none text-slate-700 focus:text-blue-600 transition-all"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <button 
        onClick={() => updateOrganizationDetails(initialData.id, { name })}
        className="w-full py-4 rounded-[20px] bg-[#f0f2f5] shadow-[8px_8px_16px_#d1d1d1,-8px_-8px_16px_#ffffff] text-slate-700 font-bold active:shadow-[inset_4px_4px_8px_#d1d1d1,inset_-4px_-4px_8px_#ffffff] transition-all"
      >
        Guardar Cambios
      </button>
    </div>
  );
}