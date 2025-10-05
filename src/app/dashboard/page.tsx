'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

interface Class { id: string; name: string | null; subject: string | null; grade_level: string | null; }
interface Profile { profile_completed: boolean; }

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClientComponentClient() // <-- CORRECCIÓN
  const [classes, setClasses] = useState<Class[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchClasses = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return;
    const { data, error } = await supabase.from('classes').select('*').eq('user_id', user.id);
    if (error) console.error("Error al cargar clases:", error);
    else setClasses(data || []);
  }, [supabase]);

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from('profiles').select('profile_completed').eq('id', user.id).single();
    if (error) console.error("Error al cargar perfil:", error);
    else setProfile(data);
  }, [supabase]);

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchClasses(), fetchProfile()]);
      setLoading(false);
    };
    loadData();
  }, [fetchClasses, fetchProfile]);

  if (loading) {
    return <div className="p-8 text-center">Cargando clases...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Mis Clases</h1>
          <p className="text-gray-500">Gestiona tus clases y exámenes</p>
        </div>
        <button
          onClick={() => {
            if (profile?.profile_completed === false) {
              router.push('/onboarding');
            } else {
              // Lógica para abrir modal
            }
          }}
          className="neu-button px-6 py-3"
        >
          Crear Nueva Clase
        </button>
      </div>
      {classes.length === 0 ? (
        <div className="text-center py-12">
          <h3>No tienes clases creadas aún</h3>
          <p>¡Crea tu primera clase para comenzar!</p>
          <button>Crear Primera Clase</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((classItem) => (
            <div key={classItem.id} className="neu-card p-6">
              <h3>{classItem.name}</h3>
              <Link href={`/dashboard/class/${classItem.id}`}>Ver Exámenes</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}