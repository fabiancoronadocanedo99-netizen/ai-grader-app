'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'

// PASO 1: Importación corregida
import { getSchoolDetailedAnalytics } from '@/actions/institutional-actions'

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface StudentRanking {
  id: string
  name: string
  average: number
  teacher: string
  subject: string
  trend: 'up' | 'down' | 'stable'
}

interface TeacherStats {
  id: string
  name: string
  average: number
  totalStudents: number
  totalGrades: number
  passRate: number
}

interface SubjectAverage {
  subject: string
  average: number
  totalGrades: number
}

interface SchoolAnalyticsData {
  success: boolean
  schoolInfo: {
    id: string
    name: string
    totalTeachers: number
    totalStudents: number
    totalExams: number
  }
  generalStats: {
    schoolAverage: number
    passRate: number
    totalGrades: number
  }
  subjectAverages: SubjectAverage[]
  teacherStats: TeacherStats[]
  topStudents: StudentRanking[]
  atRiskStudents: StudentRanking[]
}

// ─── CUSTOM TOOLTIP ──────────────────────────────────────────────────────────

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#f0f2f5',
      border: 'none',
      borderRadius: '12px',
      padding: '10px 16px',
      boxShadow: '4px 4px 10px #c8ccd1, -4px -4px 10px #ffffff',
      fontSize: '13px',
      color: '#4a5568'
    }}>
      <p style={{ fontWeight: 700, marginBottom: 4 }}>{label}</p>
      <p>Promedio: <strong style={{ color: '#5b8dee' }}>{payload[0].value}%</strong></p>
    </div>
  )
}

const CustomRadarTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#f0f2f5',
      borderRadius: '12px',
      padding: '10px 16px',
      boxShadow: '4px 4px 10px #c8ccd1, -4px -4px 10px #ffffff',
      fontSize: '13px',
      color: '#4a5568'
    }}>
      <p style={{ fontWeight: 700 }}>{payload[0].payload.subject}</p>
      <p>Promedio: <strong style={{ color: '#5b8dee' }}>{payload[0].value}%</strong></p>
    </div>
  )
}

// ─── ANIMATED COUNTER ────────────────────────────────────────────────────────

function AnimatedCounter({ target, duration = 1800 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTime: number | null = null
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    const raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return <>{count.toLocaleString('es-MX')}</>
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div style={{
      background: '#f0f2f5',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: '6px 6px 14px #c8ccd1, -6px -6px 14px #ffffff',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      <div style={{ fontSize: '28px' }}>{icon}</div>
      <p style={{ fontSize: '13px', color: '#718096', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </p>
      <p style={{ fontSize: '36px', fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: '12px', color: '#a0aec0' }}>{sub}</p>}
    </div>
  )
}

// ─── STUDENT ROW ─────────────────────────────────────────────────────────────

function StudentRow({ student, variant }: { student: StudentRanking; variant: 'star' | 'alert' }) {
  const isStar = variant === 'star'
  const trendIcon = student.trend === 'up' ? '↑' : student.trend === 'down' ? '↓' : '→'
  const trendColor = student.trend === 'up' ? '#48bb78' : student.trend === 'down' ? '#fc8181' : '#a0aec0'

  return (
    <a
      href={`/dashboard/student/${student.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '14px',
        background: '#f0f2f5',
        boxShadow: '3px 3px 8px #c8ccd1, -3px -3px 8px #ffffff',
        textDecoration: 'none',
        transition: 'box-shadow 0.2s ease',
        cursor: 'pointer'
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = 'inset 3px 3px 8px #c8ccd1, inset -3px -3px 8px #ffffff')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '3px 3px 8px #c8ccd1, -3px -3px 8px #ffffff')}
    >
      <div style={{
        width: '38px', height: '38px', borderRadius: '50%',
        background: isStar
          ? 'linear-gradient(135deg, #ffd700, #ffaa00)'
          : 'linear-gradient(135deg, #fc8181, #e53e3e)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '15px', fontWeight: 800, color: '#fff',
        flexShrink: 0,
        boxShadow: isStar ? '0 2px 8px rgba(255,170,0,0.4)' : '0 2px 8px rgba(229,62,62,0.4)'
      }}>
        {student.name.charAt(0)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, color: '#2d3748', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {student.name}
        </p>
        <p style={{ fontSize: '11px', color: '#718096', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {student.subject} · {student.teacher}
        </p>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{
          fontWeight: 800, fontSize: '16px',
          color: isStar ? '#d69e2e' : '#e53e3e'
        }}>
          {student.average}%
        </p>
        <p style={{ fontSize: '13px', color: trendColor, fontWeight: 700 }}>{trendIcon}</p>
      </div>
    </a>
  )
}

// ─── SECTION CARD ─────────────────────────────────────────────────────────────

function SectionCard({ title, children, style = {} }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#f0f2f5',
      borderRadius: '24px',
      padding: '28px',
      boxShadow: '8px 8px 18px #c8ccd1, -8px -8px 18px #ffffff',
      ...style
    }}>
      <h2 style={{
        fontSize: '16px',
        fontWeight: 800,
        color: '#2d3748',
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        marginBottom: '20px'
      }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function SchoolAnalyticsPage() {
  // PASO 2: Arreglar el ID para Next.js 15
  const params = useParams()
  const router = useRouter()

  const schoolId = useMemo(() => {
    if (!params?.id) return null
    return Array.isArray(params.id) ? params.id[0] : params.id
  }, [params])

  const [data, setData] = useState<SchoolAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // PASO 3: Asegurar que el efecto use el ID nuevo y seguro
  useEffect(() => {
    if (!schoolId) return

    const load = async () => {
      try {
        setLoading(true)
        const result = await getSchoolDetailedAnalytics(schoolId)
        if (!result.success) throw new Error('No se pudieron cargar las analíticas')

        setData(result as unknown as SchoolAnalyticsData)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [schoolId])

  // ── DERIVED DATA ──
  const creditsSaved = useMemo(() => {
    if (!data) return 0
    return data.schoolInfo.totalExams * 10 
  }, [data])

  const radarData = useMemo(() => {
    return (data?.subjectAverages || []).map(s => ({
      subject: s.subject,
      promedio: s.average,
      fullMark: 100
    }))
  }, [data])

  const teacherBarData = useMemo(() => {
    return (data?.teacherStats || [])
      .sort((a, b) => b.average - a.average)
      .map(t => ({
        name: t.name.split(' ')[0], 
        fullName: t.name,
        promedio: t.average,
        alumnos: t.totalStudents
      }))
  }, [data])

  const BAR_COLORS = ['#5b8dee', '#48bb78', '#f6ad55', '#fc8181', '#9f7aea', '#38b2ac']

  // ── LOADING ──
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#f0f2f5',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px'
      }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: '#f0f2f5',
          boxShadow: 'inset 6px 6px 12px #c8ccd1, inset -6px -6px 12px #ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            border: '3px solid transparent',
            borderTopColor: '#5b8dee',
            animation: 'spin 0.8s linear infinite'
          }} />
        </div>
        <p style={{ color: '#718096', fontWeight: 600 }}>Cargando datos institucionales...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── ERROR ──
  if (error || !data) {
    return (
      <div style={{
        minHeight: '100vh', background: '#f0f2f5',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
      }}>
        <div style={{
          background: '#f0f2f5', borderRadius: '24px', padding: '48px',
          boxShadow: '8px 8px 18px #c8ccd1, -8px -8px 18px #ffffff',
          textAlign: 'center', maxWidth: '420px'
        }}>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ color: '#e53e3e', fontWeight: 800, marginBottom: '12px' }}>Error</h2>
          <p style={{ color: '#718096', marginBottom: '24px' }}>{error || 'No se pudieron cargar los datos'}</p>
          <button
            onClick={() => router.back()}
            style={{
              padding: '12px 28px', borderRadius: '14px', border: 'none', cursor: 'pointer',
              background: '#f0f2f5', fontWeight: 700, color: '#4a5568',
              boxShadow: '4px 4px 10px #c8ccd1, -4px -4px 10px #ffffff',
              transition: 'box-shadow 0.2s'
            }}
          >
            ← Volver
          </button>
        </div>
      </div>
    )
  }

  const { schoolInfo, generalStats, topStudents, atRiskStudents } = data

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f2f5',
      padding: '32px',
      fontFamily: "'DM Sans', 'Nunito', -apple-system, sans-serif"
    }}>
      {/* ── HEADER ── */}
      <div style={{ marginBottom: '32px' }}>
        <button
          onClick={() => router.back()}
          style={{
            marginBottom: '20px',
            padding: '10px 20px', borderRadius: '14px', border: 'none', cursor: 'pointer',
            background: '#f0f2f5', fontWeight: 700, color: '#4a5568', fontSize: '14px',
            boxShadow: '4px 4px 10px #c8ccd1, -4px -4px 10px #ffffff',
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            transition: 'box-shadow 0.2s'
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = 'inset 4px 4px 10px #c8ccd1, inset -4px -4px 10px #ffffff')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = '4px 4px 10px #c8ccd1, -4px -4px 10px #ffffff')}
        >
          ← Volver
        </button>

        <div style={{
          background: '#f0f2f5',
          borderRadius: '24px',
          padding: '28px 32px',
          boxShadow: '8px 8px 18px #c8ccd1, -8px -8px 18px #ffffff'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#718096', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
                Panel Institucional
              </p>
              <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#2d3748', marginBottom: '8px', lineHeight: 1.2 }}>
                📊 {schoolInfo.name}
              </h1>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {[
                  { icon: '🧑‍🏫', val: schoolInfo.totalTeachers, label: 'maestros' },
                  { icon: '👥', val: schoolInfo.totalStudents, label: 'alumnos' },
                  { icon: '📝', val: schoolInfo.totalExams, label: 'exámenes' }
                ].map(item => (
                  <span key={item.label} style={{ fontSize: '13px', color: '#718096', fontWeight: 600 }}>
                    {item.icon} {item.val.toLocaleString()} {item.label}
                  </span>
                ))}
              </div>
            </div>
            <div style={{
              background: '#f0f2f5',
              borderRadius: '16px',
              padding: '16px 24px',
              boxShadow: 'inset 4px 4px 10px #c8ccd1, inset -4px -4px 10px #ffffff',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '11px', color: '#a0aec0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Promedio Escolar
              </p>
              <p style={{
                fontSize: '42px', fontWeight: 900, lineHeight: 1,
                color: generalStats.schoolAverage >= 80 ? '#48bb78'
                  : generalStats.schoolAverage >= 60 ? '#f6ad55'
                  : '#fc8181'
              }}>
                {generalStats.schoolAverage}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI ROW ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '28px'
      }}>
        <KpiCard
          icon="✅"
          label="Tasa de Aprobación"
          value={`${generalStats.passRate}%`}
          sub="del total de evaluados"
          color={generalStats.passRate >= 70 ? '#48bb78' : '#fc8181'}
        />
        <KpiCard
          icon="📋"
          label="Calificaciones Analizadas"
          value={generalStats.totalGrades.toLocaleString('es-MX')}
          sub="exámenes corregidos por IA"
          color="#5b8dee"
        />
        <KpiCard
          icon="⭐"
          label="Alumnos Destacados"
          value={topStudents.length}
          sub="promedio ≥ 85%"
          color="#d69e2e"
        />
        <KpiCard
          icon="🚨"
          label="Alumnos en Riesgo"
          value={atRiskStudents.length}
          sub="promedio < 60%"
          color="#e53e3e"
        />
      </div>

      {/* ── CRÉDITOS AHORRADOS ── */}
      <div style={{
        background: 'linear-gradient(135deg, #ebf4ff 0%, #f0f2f5 40%, #f0fff4 100%)',
        borderRadius: '24px',
        padding: '36px',
        marginBottom: '28px',
        boxShadow: '8px 8px 18px #c8ccd1, -8px -8px 18px #ffffff',
        display: 'flex',
        alignItems: 'center',
        gap: '32px',
        flexWrap: 'wrap'
      }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: '#f0f2f5',
          boxShadow: '6px 6px 14px #c8ccd1, -6px -6px 14px #ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '36px', flexShrink: 0
        }}>
          ⏱️
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
            Créditos de Tiempo Ahorrado
          </p>
          <p style={{ fontSize: '52px', fontWeight: 900, color: '#2b6cb0', lineHeight: 1 }}>
            <AnimatedCounter target={creditsSaved} /> min
          </p>
          <p style={{ color: '#718096', fontSize: '14px', marginTop: '6px' }}>
            Equivale a{' '}
            <strong style={{ color: '#2b6cb0' }}>
              {(creditsSaved / 60).toFixed(0)} horas
            </strong>{' '}
            de corrección manual que la IA hizo por tus maestros
          </p>
        </div>
        <div style={{
          background: '#f0f2f5',
          borderRadius: '16px',
          padding: '16px 24px',
          boxShadow: 'inset 4px 4px 10px #c8ccd1, inset -4px -4px 10px #ffffff',
          textAlign: 'center',
          flexShrink: 0
        }}>
          <p style={{ fontSize: '11px', color: '#a0aec0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
            Exámenes corregidos
          </p>
          <p style={{ fontSize: '32px', fontWeight: 900, color: '#5b8dee' }}>
            {schoolInfo.totalExams.toLocaleString('es-MX')}
          </p>
          <p style={{ fontSize: '11px', color: '#a0aec0' }}>× 10 min c/u</p>
        </div>
      </div>

      {/* ── CHARTS ROW ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '24px',
        marginBottom: '28px'
      }}>
        {/* Radar – Materias */}
        <SectionCard title="🎯 Promedio por Materia">
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid
                  stroke="#d1d5db"
                  gridType="polygon"
                />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: '#718096', fontSize: 12, fontWeight: 600 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fill: '#a0aec0', fontSize: 10 }}
                  tickCount={5}
                />
                <Radar
                  name="Promedio"
                  dataKey="promedio"
                  stroke="#5b8dee"
                  fill="#5b8dee"
                  fillOpacity={0.25}
                  strokeWidth={2}
                  dot={{ r: 5, fill: '#5b8dee', strokeWidth: 0 }}
                />
                <Tooltip content={<CustomRadarTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#a0aec0' }}>
              Sin datos de materias
            </div>
          )}
        </SectionCard>

        {/* Barras – Maestros */}
        <SectionCard title="🧑‍🏫 Comparativa por Maestro">
          {teacherBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={teacherBarData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#718096', fontSize: 11, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#a0aec0', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="promedio" radius={[8, 8, 0, 0]} name="Promedio">
                  {teacherBarData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={BAR_COLORS[index % BAR_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#a0aec0' }}>
              Sin datos de maestros
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
            {teacherBarData.map((t, i) => (
              <span key={t.name} style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                fontSize: '11px', color: '#718096', fontWeight: 600
              }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: BAR_COLORS[i % BAR_COLORS.length], flexShrink: 0 }} />
                {t.fullName}
              </span>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ── RANKINGS ROW ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px'
      }}>
        <SectionCard title="⭐ Alumnos Estrella">
          {topStudents.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {topStudents.map(student => (
                <StudentRow key={student.id} student={student} variant="star" />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#a0aec0' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>🏆</div>
              <p style={{ fontWeight: 600 }}>Sin alumnos destacados aún</p>
            </div>
          )}
        </SectionCard>

        <SectionCard title="🚨 Alumnos en Riesgo">
          {atRiskStudents.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {atRiskStudents.map(student => (
                <StudentRow key={student.id} student={student} variant="alert" />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#a0aec0' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎉</div>
              <p style={{ fontWeight: 600 }}>¡Ningún alumno en riesgo!</p>
            </div>
          )}
          {atRiskStudents.length > 0 && (
            <p style={{
              marginTop: '16px', fontSize: '12px', color: '#a0aec0',
              fontStyle: 'italic', textAlign: 'center'
            }}>
              Click en un alumno para ver su perfil completo
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  )
}