'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createOrganizationsFromCSV } from '@/actions/organization-actions'
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowLeft, Loader2, Download } from 'lucide-react'

export default function BulkUploadPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Estados para el manejo del archivo
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [result, setResult] = useState<{ success: boolean; created: number; errors: number } | null>(null)

  // Función para descargar la plantilla
  const handleDownloadTemplate = () => {
    const headers = 'name,subdomain,director_name,director_email'
    const example = 'Colegio San Mateo,sanmateo,Juan Pérez,juan@sanmateo.edu'
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${example}`
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', 'plantilla_organizaciones.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Manejo del Drag & Drop
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const validateAndSetFile = (file: File) => {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      alert('Por favor sube un archivo CSV válido.')
      return
    }
    setFile(file)
    setResult(null) // Resetear resultados anteriores
  }

  // Procesar el archivo
  const handleUpload = () => {
    if (!file) return

    startTransition(async () => {
      try {
        const text = await file.text()
        const response = await createOrganizationsFromCSV(text)
        setResult(response)
        if (response.success && response.created > 0) {
           // Opcional: limpiar el archivo si fue exitoso
           // setFile(null) 
        }
      } catch (error) {
        console.error(error)
        alert('Ocurrió un error al procesar el archivo.')
      }
    })
  }

  // Estilos Neumórficos (Sombras suaves)
  const neumorphicCard = "bg-[#e0e5ec] shadow-[9px_9px_16px_rgb(163,177,198,0.6),-9px_-9px_16px_rgba(255,255,255,0.5)] rounded-3xl"
  const neumorphicInset = "bg-[#e0e5ec] shadow-[inset_6px_6px_10px_rgb(163,177,198,0.7),inset_-6px_-6px_10px_rgba(255,255,255,0.8)] rounded-xl"
  const neumorphicBtn = "flex items-center justify-center gap-2 px-6 py-3 font-semibold text-slate-600 transition-all active:scale-95 rounded-xl bg-[#e0e5ec] shadow-[6px_6px_10px_rgb(163,177,198,0.6),-6px_-6px_10px_rgba(255,255,255,0.5)] hover:text-blue-600"
  const neumorphicBtnPrimary = "flex items-center justify-center gap-2 px-6 py-3 font-semibold text-blue-600 transition-all active:scale-95 rounded-xl bg-[#e0e5ec] shadow-[6px_6px_10px_rgb(163,177,198,0.6),-6px_-6px_10px_rgba(255,255,255,0.5)] hover:text-blue-700"

  return (
    <div className="min-h-screen bg-[#e0e5ec] text-slate-700 p-8 font-sans">

      {/* Header y Botón Volver */}
      <div className="max-w-5xl mx-auto mb-8 flex items-center justify-between">
        <Link href="/admin/organizations">
          <button className={`${neumorphicBtn} !px-4 !py-2 text-sm`}>
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-700 tracking-tight">Carga Masiva</h1>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* Columna Izquierda: Instrucciones */}
        <div className={`col-span-1 p-8 ${neumorphicCard} flex flex-col justify-between h-fit`}>
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-full bg-[#e0e5ec] shadow-[5px_5px_10px_#a3b1c6,-5px_-5px_10px_#ffffff]">
                <FileSpreadsheet className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-xl font-bold">Instrucciones</h2>
            </div>

            <p className="text-slate-500 mb-6 text-sm leading-relaxed">
              Sube un archivo CSV para crear múltiples organizaciones automáticamente.
              El sistema asignará el plan <strong>Basic</strong> por defecto.
            </p>

            <ul className="space-y-3 text-sm text-slate-600 mb-8">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                Columna 1: <strong>name</strong>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                Columna 2: <strong>subdomain</strong>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                Columna 3: <strong>director_name</strong>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                Columna 4: <strong>director_email</strong>
              </li>
            </ul>
          </div>

          <button 
            onClick={handleDownloadTemplate}
            className={`${neumorphicBtn} w-full text-sm`}
          >
            <Download className="w-4 h-4" />
            Descargar Plantilla
          </button>
        </div>

        {/* Columna Derecha: Zona de Carga */}
        <div className={`col-span-1 md:col-span-2 p-8 ${neumorphicCard}`}>

          <h2 className="text-2xl font-bold text-slate-700 mb-2">Subir Archivo</h2>
          <p className="text-slate-500 mb-8">Arrastra tu archivo CSV o haz clic para seleccionar.</p>

          {/* Zona Drag & Drop */}
          {!result ? (
            <div className="space-y-6">
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`
                  relative group cursor-pointer transition-all duration-300 h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl
                  ${isDragging ? 'bg-slate-200/50 border-blue-400' : 'hover:border-blue-300'}
                  ${file ? neumorphicInset : ''}
                `}
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                {file ? (
                  <div className="text-center animate-in fade-in zoom-in duration-300">
                    <FileSpreadsheet className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                    <p className="font-semibold text-lg text-slate-700">{file.name}</p>
                    <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                    <p className="text-xs text-blue-500 mt-2">Clic para cambiar archivo</p>
                  </div>
                ) : (
                  <div className="text-center pointer-events-none">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#e0e5ec] shadow-[5px_5px_10px_#a3b1c6,-5px_-5px_10px_#ffffff] flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                      <UploadCloud className="w-10 h-10" />
                    </div>
                    <p className="font-medium text-slate-600">Arrastra y suelta tu CSV aquí</p>
                    <p className="text-sm text-slate-400 mt-1">o haz clic para explorar</p>
                  </div>
                )}
              </div>

              {/* Botón de Acción */}
              {file && (
                <div className="flex justify-end animate-in slide-in-from-bottom-2">
                  <button
                    onClick={handleUpload}
                    disabled={isPending}
                    className={`${neumorphicBtnPrimary} w-full md:w-auto ${isPending ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>Procesar Archivo</>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (

            // Vista de Resultados
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <div className={`p-8 ${neumorphicInset} text-center mb-6`}>
                {result.created > 0 ? (
                   <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                ) : (
                   <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                )}

                <h3 className="text-2xl font-bold text-slate-700 mb-2">
                  {result.created > 0 ? '¡Proceso Completado!' : 'Proceso Finalizado'}
                </h3>
                <p className="text-slate-500 mb-6">
                  Hemos terminado de leer tu archivo CSV. Aquí tienes el resumen:
                </p>

                <div className="flex justify-center gap-4">
                  <div className="bg-white/50 rounded-xl p-4 w-32 shadow-sm">
                    <p className="text-xs text-slate-400 uppercase font-bold">Creadas</p>
                    <p className="text-3xl font-bold text-green-600">{result.created}</p>
                  </div>
                  <div className="bg-white/50 rounded-xl p-4 w-32 shadow-sm">
                    <p className="text-xs text-slate-400 uppercase font-bold">Errores</p>
                    <p className="text-3xl font-bold text-red-500">{result.errors}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  onClick={() => { setFile(null); setResult(null); }}
                  className={`${neumorphicBtn}`}
                >
                  Subir otro archivo
                </button>
                <Link href="/admin/organizations">
                  <button className={`${neumorphicBtnPrimary}`}>
                    Ver Organizaciones
                  </button>
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}