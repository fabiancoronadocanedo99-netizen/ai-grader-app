'use client'

import { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (file: File) => void;
}

export default function CameraScannerModal({ isOpen, onClose, onScanComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Efecto para encender y apagar la cámara
  useEffect(() => {
    if (isOpen) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          setStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.error("Error al acceder a la cámara:", err);
          alert("No se pudo acceder a la cámara. Asegúrate de dar los permisos necesarios.");
          onClose();
        });
    } else {
      // Limpieza: Apagar la cámara cuando el modal se cierra
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen]);

  // Función para tomar una foto
  const handleTakePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext('2d');
      context?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setCapturedImages(prev => [...prev, dataUrl]);
    }
  };

  // Función para generar el PDF
  const handleGeneratePdf = async () => {
    if (capturedImages.length === 0) return;
    setIsProcessing(true);

    const doc = new jsPDF();

    capturedImages.forEach((image, index) => {
      if (index > 0) {
        doc.addPage();
      }
      // Añadimos la imagen al PDF, ajustándola al tamaño de la página A4
      doc.addImage(image, 'JPEG', 10, 10, 190, 277); // (imagen, formato, x, y, ancho, alto)
    });

    const pdfBlob = doc.output('blob');
    const pdfFile = new File([pdfBlob], `scan_${Date.now()}.pdf`, { type: 'application/pdf' });

    onScanComplete(pdfFile);
    setCapturedImages([]); // Limpiar para la próxima vez
    setIsProcessing(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="relative neu-card p-6 max-w-3xl w-full mx-4">
        <h2 className="text-2xl font-bold text-center mb-4">Escanear Documento</h2>
        <div className="relative mb-4">
          <video ref={videoRef} autoPlay playsInline className="w-full h-auto rounded-lg" />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <button onClick={handleTakePhoto} className="neu-button rounded-full w-16 h-16 flex items-center justify-center">📸</button>
          </div>
        </div>

        <div className="mb-4 h-24 overflow-x-auto flex space-x-2 border p-2 rounded-lg bg-gray-100">
          {capturedImages.map((src, index) => (
            <img key={index} src={src} className="h-full w-auto rounded" alt={`Captura ${index + 1}`} />
          ))}
        </div>

        <div className="flex space-x-4">
          <button onClick={onClose} disabled={isProcessing} className="flex-1 neu-button py-3">Cancelar</button>
          <button onClick={handleGeneratePdf} disabled={capturedImages.length === 0 || isProcessing} className="flex-1 neu-button py-3 disabled:opacity-50">
            {isProcessing ? 'Generando PDF...' : `Crear PDF (${capturedImages.length} pág.)`}
          </button>
        </div>
      </div>
    </div>
  );
}