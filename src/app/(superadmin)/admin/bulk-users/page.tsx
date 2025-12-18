'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Download, 
  Upload, 
  FileText, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
// Importamos la Server Action
import { createUsersFromCSV } from '@/actions/user-actions';

// Utilidad para unir clases
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function BulkUsersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  // 1. Descargar plantilla
  const handleDownloadTemplate = () => {
    const headers = ['full_name', 'email', 'password', 'role', 'organization_name'];
    const csvContent = headers.join(',');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_usuarios.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Configuración de Dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setStatus('idle');
      setMessage('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    maxFiles: 1,
    multiple: false
  });

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setStatus('idle');
    setMessage('');
  };

  // 3. Procesar archivo con Server Action
  const handleProcessFile = async () => {
    if (!file) return;

    setStatus('processing');
    setMessage('');

    // Utilizamos FileReader para leer el contenido del archivo como texto
    const reader = new FileReader();

    reader.onload = async (e) => {
      const text = e.target?.result;

      if (typeof text !== 'string') {
        setStatus('error');
        setMessage('No se pudo leer el contenido del archivo.');
        return;
      }

      try {
        // Llamada a la Server Action con el string CSV
        const result = await createUsersFromCSV(text);

        if (result.success) {
          // Si la operación general fue exitosa (aunque algunos usuarios fallaran)
          setStatus('success');

          const resumenMsg = `Proceso completado: ${result.createdCount} usuarios creados, ${result.failedCount} fallidos.`;
          setMessage(resumenMsg);

          // Alert solicitado
          alert(`${resumenMsg}\n\n${result.failedCount > 0 ? 'Revisa la consola del navegador para ver los detalles de los errores.' : ''}`);

          if (result.failedCount > 0) {
            console.group('Errores en la importación CSV:');
            console.table(result.errors);
            console.groupEnd();
          }

          // Opcional: Limpiar archivo si todo fue perfecto
          if (result.failedCount === 0) {
             setFile(null);
          }

        } else {
          // Error crítico (ej. formato CSV inválido global)
          setStatus('error');
          const errorMsg = result.errors[0]?.reason || 'Error desconocido al procesar el archivo.';
          setMessage(errorMsg);
          alert(`Error: ${errorMsg}`);
        }

      } catch (error) {
        console.error(error);
        setStatus('error');
        setMessage('Ocurrió un error inesperado al comunicar con el servidor.');
      }
    };

    reader.onerror = () => {
      setStatus('error');
      setMessage('Error de lectura del archivo local.');
    };

    // Iniciar la lectura del archivo
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-[#e0e5ec] p-8 font-sans text-slate-700 flex flex-col items-center justify-center">

      {/* Tarjeta Principal Neumórfica */}
      <div className="w-full max-w-2xl rounded-3xl bg-[#e0e5ec] p-10 shadow-[9px_9px_16px_rgb(163,177,198,0.6),-9px_-9px_16px_rgba(255,255,255,0.5)]">

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-700">Crear Usuarios por Lote</h1>
          <p className="mt-2 text-sm text-slate-500">Sube un archivo CSV para importar usuarios masivamente.</p>
        </div>

        {/* Botón Descargar Plantilla */}
        <div className="mb-8 flex justify-end">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 rounded-xl bg-[#e0e5ec] px-6 py-3 text-sm font-semibold text-[#4d4d4d] transition-all 
            shadow-[6px_6px_10px_0_rgba(163,177,198,0.7),-6px_-6px_10px_0_rgba(255,255,255,0.8)] 
            hover:text-blue-600 active:shadow-[inset_4px_4px_8px_rgba(163,177,198,0.7),inset_-4px_-4px_8px_rgba(255,255,255,0.9)]"
          >
            <Download className="h-4 w-4" />
            Descargar Plantilla CSV
          </button>
        </div>

        {/* Dropzone Area */}
        <div
          {...getRootProps()}
          className={cn(
            "relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-transparent p-12 transition-all duration-300",
            "bg-[#e0e5ec] shadow-[inset_6px_6px_12px_#b8b9be,inset_-6px_-6px_12px_#ffffff]",
            isDragActive && "border-blue-400 bg-slate-100",
            status === 'error' && "border-red-300 bg-red-50/50"
          )}
        >
          <input {...getInputProps()} />

          {!file ? (
            <div className="flex flex-col items-center text-slate-500">
              <div className="mb-4 rounded-full bg-[#e0e5ec] p-4 shadow-[6px_6px_10px_#b8b9be,-6px_-6px_10px_#ffffff]">
                <Upload className="h-8 w-8 text-blue-500/80" />
              </div>
              <p className="text-lg font-medium">Arrastra tu archivo CSV aquí</p>
              <p className="text-sm opacity-70">o haz clic para seleccionar</p>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between rounded-xl p-4">
              <div className="flex items-center gap-4">
                 <div className="rounded-full bg-[#e0e5ec] p-3 shadow-[5px_5px_10px_#b8b9be,-5px_-5px_10px_#ffffff]">
                    <FileText className="h-6 w-6 text-green-600" />
                 </div>
                 <div className="text-left">
                    <p className="font-semibold text-slate-700">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                 </div>
              </div>

              {status !== 'processing' && (
                <button
                  onClick={removeFile}
                  className="rounded-full p-2 text-slate-400 transition-colors hover:bg-red-100 hover:text-red-500"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Mensajes de Estado */}
        {message && (
          <div className={cn(
            "mt-6 flex items-center gap-2 rounded-xl p-4 text-sm font-medium animate-in fade-in slide-in-from-top-2",
            status === 'success' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          )}>
            {status === 'success' ? <CheckCircle2 className="h-5 w-5"/> : <AlertCircle className="h-5 w-5"/>}
            <span className="whitespace-pre-line">{message}</span>
          </div>
        )}

        {/* Botón de Acción Principal */}
        <div className="mt-10">
          <button
            onClick={handleProcessFile}
            disabled={!file || status === 'processing'}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl py-4 text-lg font-bold uppercase tracking-wider transition-all",
              // Estilo Neumórfico Saliente
              "bg-[#e0e5ec] text-[#4d4d4d]",
              "shadow-[6px_6px_12px_#b8b9be,-6px_-6px_12px_#ffffff]",
              // Hover
              !file || status === 'processing' ? "" : "hover:text-blue-600 hover:shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff]",
              // Active / Pressed
              "active:shadow-[inset_4px_4px_8px_#b8b9be,inset_-4px_-4px_8px_#ffffff]",
              // Disabled state
              (!file || status === 'processing') && "cursor-not-allowed opacity-50 shadow-none active:shadow-none"
            )}
          >
            {status === 'processing' ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Procesando...
              </>
            ) : (
              "Procesar Archivo"
            )}
          </button>
        </div>

      </div>
    </div>
  );
}