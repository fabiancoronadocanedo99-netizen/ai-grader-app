'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'

export default function OnboardingPage() {
  const supabase = createClient();
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [subject, setSubject] = useState('')
  const [country, setCountry] = useState('')
  const [institution, setInstitution] = useState('')
  const [yearsExperience, setYearsExperience] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado.')

      // --- CÓDIGO CORREGIDO ---
      const profileData = {
        id: user.id, // <-- LA CORRECCIÓN CLAVE: Incluir el ID del usuario
        full_name: fullName,
        subject: subject,
        country: country,
        institution: institution,
        years_experience: parseInt(yearsExperience) || 0,
        profile_completed: true
      }

      const { error } = await supabase
        .from('profiles')
        .upsert(profileData) // Usamos la variable con todos los datos
      // --- FIN DE LA CORRECCIÓN ---

      if (error) throw error

      alert('¡Perfil guardado con éxito!'); // Feedback positivo para el usuario
      router.push('/dashboard')
    } catch (error) {
      console.error('Error al guardar el perfil:', error)
      alert(`Error al guardar el perfil: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen neu-container flex items-center justify-center p-4">
      <div className="w-full max-w-2xl neu-card p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-700 mb-2">
            ¡Bienvenido a AI Grader!
          </h1>
          <p className="text-gray-600">
            Completa tu perfil para comenzar a usar la plataforma
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
              Nombre Completo *
            </label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="neu-input w-full p-4 text-gray-700 placeholder-gray-500"
              placeholder="Ej: María García López"
            />
          </div>

          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
              Materia Principal *
            </label>
            <input
              type="text"
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="neu-input w-full p-4 text-gray-700 placeholder-gray-500"
              placeholder="Ej: Matemáticas, Ciencias, Historia..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
                País *
              </label>
              <input
                type="text"
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
                className="neu-input w-full p-4 text-gray-700 placeholder-gray-500"
                placeholder="Ej: México, España, Colombia..."
              />
            </div>

            <div>
              <label htmlFor="yearsExperience" className="block text-sm font-medium text-gray-700 mb-2">
                Años de Experiencia
              </label>
              <input
                type="number"
                id="yearsExperience"
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
                min="0"
                className="neu-input w-full p-4 text-gray-700 placeholder-gray-500"
                placeholder="Ej: 5"
              />
            </div>
          </div>

          <div>
            <label htmlFor="institution" className="block text-sm font-medium text-gray-700 mb-2">
              Institución Educativa
            </label>
            <input
              type="text"
              id="institution"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="neu-input w-full p-4 text-gray-700 placeholder-gray-500"
              placeholder="Ej: Escuela Primaria Benito Juárez"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="neu-button w-full text-gray-700 font-semibold py-4 px-6 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando Perfil...' : 'Completar Configuración'}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-500">
              * Campos obligatorios
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}