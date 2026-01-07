'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
// IMPORTAMOS LA SERVER ACTION
import { updateUserCreditLimit } from '@/actions/user-actions'; 
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

// --- UTILIDADES ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- TIPOS ---
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
  // --- ESTADOS ---
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'gestion' | 'analiticas'>('gestion');

  // Estados del Modal de Edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [newCreditLimit, setNewCreditLimit] = useState<number>(0);
  const [updatingUser, setUpdatingUser] = useState(false);

  // --- EFECTO: CARGA DE DATOS ---
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

  // --- MANEJADORES ---
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
      // CAMBIO CLAVE: Usamos la Server Action en lugar de supabase.update directo
      // Esto es más seguro y centraliza la lógica de validación
      const result = await updateUserCreditLimit(selectedUser.id, newCreditLimit);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Actualizar estado local para reflejar cambios sin recargar
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

  // --- RENDERIZADO DE CARGA/ERROR (se mantiene igual) ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#e0e5ec] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <p className="font-medium">Cargando panel de administración...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#e0e5ec] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#e0e5ec] rounded-2xl p-8 shadow-[6px_6px_12px_#b8b9be,-6px_-6px_12px_#ffffff] text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-700 mb-2">Acceso Denegado o Error</h2>
          <p className="text-slate-500">{error}</p>
          <Link href="/dashboard">
            <button className="mt-6 px-6 py-2 rounded-xl bg-[#e0e5ec] text-slate-600 font-semibold shadow-[4px_4px_8px_#b8b9be,-4px_-4px_8px_#ffffff] hover:text-blue-600 active:shadow-[inset_2px_2px_4px_#b8b9be,inset_-2px_-2px_4px_#ffffff] transition-all">
              Volver al Dashboard
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-[#e0e5ec] p-6 md:p-12 font-sans text-slate-700">

      {/* ENCABEZADO */}
      <div className="max-w-7xl mx-auto mb-10">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-700">
          Gestión de la Institución
        </h1>
        <p className="text-slate-500 mt-1 text-lg uppercase tracking-wider font-bold">
          {data.organization.name}
        </p>
      </div>

      {/* PESTAÑAS (TABS) */}
      <div className="max-w-7xl mx-auto mb-10 flex gap-6">
        <button
          onClick={() => setActiveTab('gestion')}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300",
            activeTab === 'gestion'
              ? "text-blue-600 shadow-[inset_4px_4px_8px_#b8b9be,inset_-4px_-4px_8px_#ffffff]"
              : "text-slate-500 shadow-[6px_6px_12px_#b8b9be,-6px_-6px_12px_#ffffff] hover:text-blue-500"
          )}
        >
          <Settings2 className="w-5 h-5" />
          Gestión de Maestros
        </button>

        <button
          onClick={() => setActiveTab('analiticas')}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300",
            activeTab === 'analiticas'
              ? "text-blue-600 shadow-[inset_4px_4px_8px_#b8b9be,inset_-4px_-4px_8px_#ffffff]"
              : "text-slate-500 shadow-[6px_6px_12px_#b8b9be,-6px_-6px_12px_#ffffff] hover:text-blue-500"
          )}
        >
          <BarChart3 className="w-5 h-5" />
          Métricas de Clase
        </button>
      </div>

      {/* CONTENIDO PESTAÑA: GESTIÓN */}
      {activeTab === 'gestion' && (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Tarjetas KPI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-3xl bg-[#e0e5ec] p-6 shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff]">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-full bg-[#e0e5ec] shadow-[inset_3px_3px_6px_#b8b9be,inset_-3px_-3px_6px_#ffffff]">
                  <Coins className="w-6 h-6 text-yellow-600" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Institucional</span>
              </div>
              <h3 className="text-3xl font-bold text-slate-700">{data.organization.credits_remaining.toLocaleString()}</h3>
              <p className="text-xs text-slate-500 mt-1">Créditos disponibles para la escuela</p>
            </div>

             <div className="rounded-3xl bg-[#e0e5ec] p-6 shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff]">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-full bg-[#e0e5ec] shadow-[inset_3px_3px_6px_#b8b9be,inset_-3px_-3px_6px_#ffffff]">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plantilla</span>
              </div>
              <h3 className="text-3xl font-bold text-slate-700">{data.users.length}</h3>
              <p className="text-xs text-slate-500 mt-1">Colaboradores activos</p>
            </div>

            <div className="rounded-3xl bg-[#e0e5ec] p-6 shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff]">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-full bg-[#e0e5ec] shadow-[inset_3px_3px_6px_#b8b9be,inset_-3px_-3px_6px_#ffffff]">
                  <GraduationCap className="w-6 h-6 text-green-600" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nivel de Servicio</span>
              </div>
              <h3 className="text-xl font-bold text-slate-700 capitalize">{data.organization.subscription_plan || 'Estándar'}</h3>
              <p className="text-xs text-slate-500 mt-1">Plan de suscripción activo</p>
            </div>
          </div>

          {/* Tabla de Usuarios */}
          <div className="rounded-3xl bg-[#e0e5ec] p-8 shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff]">
            <h2 className="text-xl font-bold text-slate-700 mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Gestión de Límites por Maestro
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-300/30">
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Maestro</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Rol</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Límite (IA)</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Uso Actual</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {data.users.map((user) => (
                    <tr key={user.id} className="group border-b border-slate-200/50 hover:bg-slate-300/10 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-700">{user.full_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">ID: {user.id.slice(0,8)}</div>
                      </td>
                      <td className="p-4">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-[inset_2px_2px_4px_#b8b9be,inset_-2px_-2px_4px_#ffffff]",
                          user.role === 'admin' ? "text-purple-600" : "text-blue-600"
                        )}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleOpenEditModal(user)}
                          className="group/btn relative inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-slate-600 transition-all 
                          shadow-[5px_5px_10px_#b8b9be,-5px_-5px_10px_#ffffff] 
                          hover:text-blue-600 active:shadow-[inset_3px_3px_6px_#b8b9be,inset_-3px_-3px_6px_#ffffff]"
                        >
                          {user.monthly_credit_limit}
                          <Edit2 className="w-3 h-3 opacity-30 group-hover/btn:opacity-100 transition-opacity" />
                        </button>
                      </td>
                      <td className="p-4 text-center font-bold text-slate-500">
                        {user.monthly_credits_used}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* SECCIÓN ANALÍTICAS (Se mantiene igual pero con mejores fuentes) */}
      {activeTab === 'analiticas' && (
        <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
           <h2 className="text-xl font-bold text-slate-700 mb-8 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-indigo-500" />
              Rendimiento por Grupo
            </h2>

            {data.classes.length === 0 ? (
              <div className="rounded-3xl p-12 text-center text-slate-400 shadow-[inset_6px_6px_12px_#b8b9be,inset_-6px_-6px_12px_#ffffff]">
                No hay clases registradas en esta organización todavía.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {data.classes.map((group) => (
                  <Link href={`/dashboard/class/${group.id}/analytics`} key={group.id} className="block group">
                    <div className="h-full rounded-[30px] bg-[#e0e5ec] p-8 transition-all duration-300
                      shadow-[10px_10px_20px_#b8b9be,-10px_-10px_20px_#ffffff]
                      group-hover:translate-y-[-6px] group-hover:shadow-[15px_15px_25px_#b8b9be,-15px_-15px_25px_#ffffff]
                      active:shadow-[inset_4px_4px_8px_#b8b9be,inset_-4px_-4px_8px_#ffffff] active:translate-y-[0px]"
                    >
                      <div className="p-4 w-14 h-14 mb-6 rounded-2xl bg-[#e0e5ec] shadow-[inset_3px_3px_6px_#b8b9be,inset_-3px_-3px_6px_#ffffff] flex items-center justify-center">
                        <BarChart3 className="w-8 h-8 text-indigo-500" />
                      </div>
                      <h3 className="text-xl font-black text-slate-700 mb-1">{group.name}</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{group.subject || 'Materia General'}</p>

                      <div className="mt-8 flex items-center gap-2 text-xs font-black text-blue-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                        Ver Analíticas de Alumnos <span className="text-lg">→</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
        </div>
      )}

      {/* MODAL DE EDICIÓN */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#e0e5ec] rounded-[40px] p-10 shadow-[20px_20px_60px_rgba(0,0,0,0.1),-20px_-20px_60px_rgba(255,255,255,0.8)] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black text-slate-700 uppercase tracking-tight">Ajustar Límite</h3>
              <button onClick={handleCloseModal} className="w-10 h-10 rounded-full flex items-center justify-center bg-[#e0e5ec] shadow-[4px_4px_8px_#b8b9be,-4px_-4px_8px_#ffffff] text-slate-400 hover:text-red-500 active:shadow-inset transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-8 p-4 rounded-2xl shadow-[inset_4px_4px_8px_#b8b9be,inset_-4px_-4px_8px_#ffffff]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Colaborador</p>
              <p className="text-lg font-bold text-slate-700">{selectedUser.full_name}</p>
            </div>

            <div className="mb-10">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Créditos IA Mensuales</label>
              <div className="relative">
                 <input
                  type="number"
                  min="0"
                  value={newCreditLimit}
                  onChange={(e) => setNewCreditLimit(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#e0e5ec] rounded-2xl p-5 text-slate-700 font-black text-2xl outline-none transition-all
                  shadow-[inset_6px_6px_12px_#b8b9be,inset_-6px_-6px_12px_#ffffff]
                  focus:text-blue-600"
                />
              </div>
            </div>

            <div className="flex gap-6">
              <button
                onClick={handleCloseModal}
                className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-500 bg-[#e0e5ec] shadow-[6px_6px_12px_#b8b9be,-6px_-6px_12px_#ffffff] active:shadow-inset transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveLimit}
                disabled={updatingUser}
                className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-blue-600 bg-[#e0e5ec] shadow-[6px_6px_12px_#b8b9be,-6px_-6px_12px_#ffffff] active:shadow-inset disabled:opacity-50 transition-all flex justify-center items-center gap-2"
              >
                {updatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Actualizar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}