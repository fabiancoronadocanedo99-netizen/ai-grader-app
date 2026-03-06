'use client';
export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { updateUserCreditLimit } from '@/actions/user-actions';
import { getSchoolDetailedAnalytics } from '@/actions/institutional-actions';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { 
  Users, 
  GraduationCap, 
  Coins, 
  BarChart3, 
  Settings2, 
  Edit2, 
  X, 
  Save,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Organization = {
  id: string;
  name: string;
  credits_remaining: number;
  credits_per_period: number;
  subscription_plan: string;
};

type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  monthly_credit_limit: number;
  monthly_credits_used: number;
};

type ClassGroup = {
  id: string;
  name: string;
  subject?: string;
};

type DashboardData = {
  organization: Organization;
  users: UserProfile[];
  classes: ClassGroup[];
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'gestion' | 'analiticas'>('gestion');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [newCreditLimit, setNewCreditLimit] = useState<number>(0);
  const [updatingUser, setUpdatingUser] = useState(false);

  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/get-organization-dashboard');
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Error al cargar datos');
        }
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    async function loadAnalytics() {
      if (activeTab === 'analiticas' && data?.organization?.id && !analyticsData) {
        setLoadingAnalytics(true);
        const result = await getSchoolDetailedAnalytics(data.organization.id);
        if (result.success) {
          setAnalyticsData(result);
        }
        setLoadingAnalytics(false);
      }
    }
    loadAnalytics();
  }, [activeTab, data, analyticsData]);

  const handleOpenEditModal = (user: UserProfile) => {
    setSelectedUser(user);
    setNewCreditLimit(user.monthly_credit_limit || 0);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const handleSaveLimit = async () => {
    if (!selectedUser) return;
    setUpdatingUser(true);

    try {
      const result = await updateUserCreditLimit(selectedUser.id, newCreditLimit);
      if (!result.success) throw new Error(result.error);

      if (data) {
        const updatedUsers = data.users.map(u => 
          u.id === selectedUser.id ? { ...u, monthly_credit_limit: newCreditLimit } : u
        );
        setData({ ...data, users: updatedUsers });
      }
      handleCloseModal();
    } catch (err: any) {
      alert('Error al actualizar: ' + err.message);
    } finally {
      setUpdatingUser(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#e0e5ec] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#e0e5ec] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#e0e5ec] rounded-2xl p-8 shadow-[6px_6px_12px_#b8b9be,-6px_-6px_12px_#ffffff] text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-500">{error || 'No se pudieron cargar los datos'}</p>
          <Link href="/dashboard">
            <button className="mt-6 px-6 py-2 rounded-xl bg-[#e0e5ec] shadow-[4px_4px_8px_#b8b9be,-4px_-4px_8px_#ffffff] font-bold">Volver</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#e0e5ec] p-6 md:p-12 font-sans text-slate-700">
      <div className="max-w-7xl mx-auto mb-10">
        <h1 className="text-2xl md:text-3xl font-bold">Gestión de la Institución</h1>
        <p className="text-slate-500 mt-1 uppercase tracking-wider font-bold">{data.organization.name}</p>
      </div>

      <div className="max-w-7xl mx-auto mb-10 flex gap-6">
        <button
          onClick={() => setActiveTab('gestion')}
          className={cn("px-6 py-3 rounded-xl font-bold transition-all", activeTab === 'gestion'
            ? "text-blue-600 shadow-[inset_4px_4px_8px_#b8b9be,inset_-4px_-4px_8px_#ffffff]"
            : "text-slate-500 shadow-[6px_6px_12px_#b8b9be,-6px_-6px_12px_#ffffff]"
          )}
        >
          Gestión
        </button>
        <button
          onClick={() => setActiveTab('analiticas')}
          className={cn("px-6 py-3 rounded-xl font-bold transition-all", activeTab === 'analiticas'
            ? "text-blue-600 shadow-[inset_4px_4px_8px_#b8b9be,inset_-4px_-4px_8px_#ffffff]"
            : "text-slate-500 shadow-[6px_6px_12px_#b8b9be,-6px_-6px_12px_#ffffff]"
          )}
        >
          Métricas
        </button>
      </div>

      {/* ── TAB: GESTIÓN ── */}
      {activeTab === 'gestion' && (
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="neu-card p-6 rounded-3xl shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff]">
              <Coins className="mb-2 text-yellow-600" />
              <h3 className="text-3xl font-bold">{data.organization.credits_remaining.toLocaleString()}</h3>
              <p className="text-xs text-slate-500">Créditos institucionales</p>
            </div>
            <div className="neu-card p-6 rounded-3xl shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff]">
              <Users className="mb-2 text-blue-600" />
              <h3 className="text-3xl font-bold">{data.users.length}</h3>
              <p className="text-xs text-slate-500">Maestros activos</p>
            </div>
            <div className="neu-card p-6 rounded-3xl shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff]">
              <GraduationCap className="mb-2 text-green-600" />
              <h3 className="text-xl font-bold">{data.organization.subscription_plan || 'Estándar'}</h3>
              <p className="text-xs text-slate-500">Plan actual</p>
            </div>
          </div>

          <div className="rounded-3xl bg-[#e0e5ec] p-8 shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff] overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 border-b border-slate-300/30">
                  <th className="p-4 text-[10px] font-black uppercase">Maestro</th>
                  <th className="p-4 text-[10px] font-black uppercase text-center">Límite</th>
                  <th className="p-4 text-[10px] font-black uppercase text-center">Uso</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-200/50">
                    <td className="p-4 font-bold">{user.full_name}</td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleOpenEditModal(user)}
                        className="px-4 py-2 rounded-xl shadow-[4px_4px_8px_#b8b9be,-4px_-4px_8px_#ffffff] hover:text-blue-600 flex items-center gap-2 mx-auto"
                      >
                        {user.monthly_credit_limit} <Edit2 size={12}/>
                      </button>
                    </td>
                    <td className="p-4 text-center font-bold text-slate-500">{user.monthly_credits_used}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: MÉTRICAS / ANALÍTICAS ── */}
      {activeTab === 'analiticas' && (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
          {loadingAnalytics ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            </div>
          ) : analyticsData ? (
            <>
              {/* KPI CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="p-6 rounded-3xl bg-[#e0e5ec] shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff]">
                  <div className="text-green-600 mb-2 text-xl">✅</div>
                  <p className="text-xs font-black uppercase opacity-40">Tasa Aprobación</p>
                  <h3 className="text-3xl font-black text-blue-600">{analyticsData.generalStats.passRate}%</h3>
                  <p className="text-[10px] opacity-60">Alumnos con nota &gt; 60%</p>
                </div>
                <div className="p-6 rounded-3xl bg-[#e0e5ec] shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff]">
                  <div className="text-amber-600 mb-2 text-xl">📋</div>
                  <p className="text-xs font-black uppercase opacity-40">Evaluaciones</p>
                  <h3 className="text-3xl font-black text-blue-600">{analyticsData.schoolInfo.totalExams}</h3>
                  <p className="text-[10px] opacity-60">Procesadas por AI Grader</p>
                </div>
                <div className="p-6 rounded-3xl bg-[#e0e5ec] shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff]">
                  <div className="text-yellow-500 mb-2 text-xl">⭐</div>
                  <p className="text-xs font-black uppercase opacity-40">Excelencia</p>
                  <h3 className="text-3xl font-black text-blue-600">{analyticsData.topStudents.length}</h3>
                  <p className="text-[10px] opacity-60">Alumnos destacados</p>
                </div>
                <div className="p-6 rounded-3xl bg-[#e0e5ec] shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff]">
                  <div className="text-red-600 mb-2 text-xl">🚨</div>
                  <p className="text-xs font-black uppercase opacity-40">En Riesgo</p>
                  <h3 className="text-3xl font-black text-blue-600">{analyticsData.atRiskStudents.length}</h3>
                  <p className="text-[10px] opacity-60">Atención psicopedagógica</p>
                </div>
              </div>

              {/* BANNER ROI */}
              <div className="rounded-3xl bg-[#e0e5ec] p-8 shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff] flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-full bg-[#e0e5ec] shadow-[6px_6px_12px_#b8b9be,-6px_-6px_12px_#ffffff] flex items-center justify-center text-2xl">
                    🕒
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase opacity-40">Carga Administrativa Eliminada</p>
                    <h2 className="text-5xl font-black text-slate-700">
                      {analyticsData.schoolInfo.totalExams * 10} min
                    </h2>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black uppercase opacity-40">Impacto Mensual:</p>
                  <h2 className="text-3xl font-black text-blue-600">
                    {Math.round((analyticsData.schoolInfo.totalExams * 10) / 60)} HORAS DOCENTES
                  </h2>
                  <p className="text-[10px] font-bold opacity-40 uppercase">Recuperadas para el acompañamiento</p>
                </div>
              </div>

              {/* GRÁFICAS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="rounded-3xl bg-[#e0e5ec] p-6 shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff]">
                  <h3 className="text-lg font-black mb-6 uppercase tracking-widest opacity-40">Radar de Materias</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={analyticsData.subjectAverages}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" />
                        <PolarRadiusAxis domain={[0, 100]} tick={false} />
                        <Radar name="Promedio" dataKey="average" stroke="#2563eb" fill="#2563eb" fillOpacity={0.6} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rounded-3xl bg-[#e0e5ec] p-6 shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff]">
                  <h3 className="text-lg font-black mb-6 uppercase tracking-widest opacity-40">Ranking Docente</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.teacherStats}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Bar dataKey="average" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* ALUMNOS DESTACADOS Y EN RIESGO */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="rounded-3xl bg-[#e0e5ec] p-6 shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff]">
                  <h3 className="text-lg font-black mb-4 uppercase tracking-widest opacity-40">⭐ Alumnos Estrella</h3>
                  <div className="space-y-3">
                    {analyticsData.topStudents.length === 0 ? (
                      <p className="text-sm opacity-40 text-center py-6">Sin datos suficientes</p>
                    ) : analyticsData.topStudents.map((s: any, i: number) => (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-2xl shadow-[inset_3px_3px_6px_#b8b9be,inset_-3px_-3px_6px_#ffffff]">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black opacity-30">#{i + 1}</span>
                          <div>
                            <p className="font-bold text-sm">{s.name}</p>
                            <p className="text-[10px] opacity-40">{s.subject} · {s.teacher}</p>
                          </div>
                        </div>
                        <span className="font-black text-green-600">{s.average}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl bg-[#e0e5ec] p-6 shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff]">
                  <h3 className="text-lg font-black mb-4 uppercase tracking-widest opacity-40">🚨 Alumnos en Riesgo</h3>
                  <div className="space-y-3">
                    {analyticsData.atRiskStudents.length === 0 ? (
                      <p className="text-sm opacity-40 text-center py-6">¡Sin alumnos en riesgo!</p>
                    ) : analyticsData.atRiskStudents.map((s: any, i: number) => (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-2xl shadow-[inset_3px_3px_6px_#b8b9be,inset_-3px_-3px_6px_#ffffff]">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black opacity-30">#{i + 1}</span>
                          <div>
                            <p className="font-bold text-sm">{s.name}</p>
                            <p className="text-[10px] opacity-40">{s.subject} · {s.teacher}</p>
                          </div>
                        </div>
                        <span className="font-black text-red-500">{s.average}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-3xl bg-[#e0e5ec] p-20 text-center shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff] opacity-40">
              <p className="text-xl font-black">No hay suficientes datos para generar analíticas aún.</p>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL EDITAR LÍMITE ── */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#e0e5ec] rounded-[40px] p-10 shadow-[20px_20px_60px_#b8b9be,-20px_-20px_60px_#ffffff]">
            <h3 className="text-xl font-black mb-6 uppercase">Ajustar Límite</h3>
            <div className="mb-6 p-4 rounded-2xl shadow-[inset_4px_4px_8px_#b8b9be,inset_-4px_-4px_8px_#ffffff]">
              <p className="text-lg font-bold">{selectedUser.full_name}</p>
            </div>
            <input
              type="number"
              value={newCreditLimit}
              onChange={(e) => setNewCreditLimit(parseInt(e.target.value) || 0)}
              className="w-full bg-[#e0e5ec] rounded-2xl p-5 text-2xl font-black shadow-[inset_6px_6px_12px_#b8b9be,inset_-6px_-6px_12px_#ffffff] outline-none mb-8"
            />
            <div className="flex gap-4">
              <button onClick={handleCloseModal} className="flex-1 py-4 rounded-2xl font-black shadow-[4px_4px_8px_#b8b9be,-4px_-4px_8px_#ffffff]">
                Cancelar
              </button>
              <button
                onClick={handleSaveLimit}
                disabled={updatingUser}
                className="flex-1 py-4 rounded-2xl font-black text-blue-600 shadow-[4px_4px_8px_#b8b9be,-4px_-4px_8px_#ffffff] flex justify-center items-center gap-2"
              >
                {updatingUser ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}