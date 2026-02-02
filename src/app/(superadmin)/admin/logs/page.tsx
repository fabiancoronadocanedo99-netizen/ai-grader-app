'use client'

import { useState, useEffect } from 'react'
import { getAuditLogs } from '@/actions/audit-actions'
import { FileText, Clock, User, Activity, Database, Search } from 'lucide-react'

// Tipos
interface AuditLog {
  id: string
  created_at: string
  user_email: string
  action: string
  entity_type: string
  entity_id: string
  details: any
  ip_address?: string
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchLogs = async () => {
      const response = await getAuditLogs()
      if (response.success && response.data) {
        setLogs(response.data)
      }
      setLoading(false)
    }
    fetchLogs()
  }, [])

  // Filtrado simple
  const filteredLogs = logs.filter(log => 
    log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.entity_type?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Estilos Neumórficos
  const neuBase = "bg-[#e0e5ec] text-slate-700"
  const neuCard = "bg-[#e0e5ec] shadow-[9px_9px_16px_rgb(163,177,198,0.6),-9px_-9px_16px_rgba(255,255,255,0.5)] rounded-2xl"
  const neuInset = "bg-[#e0e5ec] shadow-[inset_6px_6px_10px_rgb(163,177,198,0.6),inset_-6px_-6px_10px_rgba(255,255,255,0.5)] rounded-xl"

  if (loading) {
    return (
      <div className={`min-h-screen ${neuBase} flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${neuBase} p-8 font-sans`}>

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            Logs de Auditoría
          </h1>
          <p className="text-slate-500 mt-1">Historial de movimientos y acciones críticas del sistema</p>
        </div>

        {/* Buscador */}
        <div className="relative w-full md:w-96">
          <input
            type="text"
            placeholder="Buscar por usuario, acción o entidad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full py-3 pl-10 pr-4 outline-none text-slate-600 ${neuInset}`}
          />
          <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
        </div>
      </div>

      {/* Tabla */}
      <div className={`${neuCard} p-6 overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-300">
                <th className="pb-4 pl-2 font-bold flex items-center gap-1"><Clock className="w-3 h-3"/> Fecha</th>
                <th className="pb-4 font-bold"><div className="flex items-center gap-1"><User className="w-3 h-3"/> Usuario</div></th>
                <th className="pb-4 font-bold"><div className="flex items-center gap-1"><Activity className="w-3 h-3"/> Acción</div></th>
                <th className="pb-4 font-bold"><div className="flex items-center gap-1"><Database className="w-3 h-3"/> Entidad</div></th>
                <th className="pb-4 font-bold">Detalles</th>
              </tr>
            </thead>
            <tbody className="text-slate-600 text-sm">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-200/50 hover:bg-slate-200/30 transition-colors">
                  <td className="py-4 pl-2 whitespace-nowrap text-xs text-slate-500">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="py-4 font-medium text-blue-600">
                    {log.user_email}
                    <div className="text-[10px] text-slate-400 font-mono">{log.ip_address || 'IP desconocida'}</div>
                  </td>
                  <td className="py-4">
                    <span className="px-2 py-1 rounded bg-slate-200 text-slate-600 text-xs font-bold uppercase">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-4 text-xs">
                    <div className="font-bold">{log.entity_type}</div>
                    <div className="font-mono text-[10px] text-slate-400">{log.entity_id}</div>
                  </td>
                  <td className="py-4 max-w-xs">
                    <pre className="text-[10px] bg-white/50 p-2 rounded border border-slate-200 overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    No se encontraron registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}