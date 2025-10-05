'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'
import CreateClassModal from '../../components/CreateClassModal' // Asegúrate de importar tu modal

interface Class { id: string; name: string | null; subject: string | null; grade_level: string | null; }
interface Profile { profile_completed: boolean; }

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [classes, setClasses] = useState<Class[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false) // <-- CORRECCIÓN: Declaración del estado

  const fetchClasses = useCallback(async () => {
    // ... (tu función fetchClasses se mantiene igual)
  }, [supabase]);

  const fetchProfile = useCallback(async () => {
    // ... (tu función fetchProfile se mantiene igual)
  }, [supabase]);

  // Renombramos fetchData a onDataChange para claridad
  const onDataChange = useCallback(() => {
    fetchClasses();
    fetchProfile();
  }, [fetchClasses, fetchProfile]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchClasses(), fetchProfile()]);
      setLoading(false);
    };
    loadData();
  }, [fetchClasses, fetchProfile]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const handleCreateClassClick = () => {
    if (profile?.profile_completed === false) {
      router.push('/onboarding');
    } else {
      setIsModalOpen(true); // <-- CORRECCIÓN: Abre el modal
    }
  };

  return (
    <div className="p-8 neu-container min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-700">Mis Clases</h1>
          <p className="text-gray-500">Gestiona tus clases y exámenes</p>
        </div>
        <button
          onClick={handleCreateClassClick}
          className="neu-button px-6 py-3 font-semibold text-gray-700"
        >
          Crear Nueva Clase
        </button>
      </div>
      {classes.length === 0 ? (
        <div className="text-center py-16 neu-card">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-semibold text-gray-700">No tienes clases creadas aún</h3>
          <p className="text-gray-600 mb-6">¡Crea tu primera clase para comenzar!</p>
          <button 
            onClick={handleCreateClassClick}
            className="neu-button px-8 py-4 font-bold text-gray-800"
          >
            Crear Primera Clase
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-