import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import usePlanes, { crearPlan, actualizarPlan, togglePlanActive, eliminarPlan } from '../hooks/usePlanes';
import useSuscripciones from '../hooks/useSuscripciones';
import { useAdminConfig, updateAdminConfig, sanitizarWhatsApp } from '../hooks/useAdminConfig';
import PlanForm from '../components/PlanForm';
import { useMoneda } from '../hooks/useMoneda';
import { Package, Plus, Edit, ToggleLeft, Trash2, AlertCircle, MessageCircle, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { type Plan, type PlanInput } from '../types/plan';

export default function AdminPlanes() {
  const { user } = useAuth();
  const { planes, loading, error } = usePlanes(user);
  const { suscripciones } = useSuscripciones(user);
  const { config, loading: configLoading } = useAdminConfig();
  const { formatearDesdeBase } = useMoneda();
  const [whatsapp, setWhatsapp] = useState(config.whatsapp);
  const [guardandoWhatsapp, setGuardandoWhatsapp] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Sincroniza el input cuando se carga la config desde Firestore
  useEffect(() => {
    if (!configLoading) {
      setWhatsapp(config.whatsapp);
    }
  }, [config.whatsapp, configLoading]);

  const handleGuardarWhatsapp = async () => {
    setGuardandoWhatsapp(true);
    try {
      await updateAdminConfig({ whatsapp });
      toast.success('WhatsApp guardado correctamente');
    } catch (err) {
      console.error('Error guardando WhatsApp:', err);
      toast.error('Error al guardar el número de WhatsApp');
    } finally {
      setGuardandoWhatsapp(false);
    }
  };

  const activeSubsByPlan = suscripciones
    .filter(s => s.estado === 'activa')
    .reduce((acc, s) => {
      acc[s.planId] = (acc[s.planId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const openCreate = () => {
    setEditingPlan(null);
    setShowForm(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setShowForm(true);
  };

  const handleSave = async (data: PlanInput) => {
    if (editingPlan) {
      await actualizarPlan(editingPlan.id, data);
    } else {
      await crearPlan(data);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    setTogglingId(id);
    try {
      await togglePlanActive(id, current);
      toast.success(`Plan ${current ? 'desactivado' : 'activado'} correctamente`);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error toggling plan:', error);
      toast.error('Error al cambiar estado del plan');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este plan?')) return;

    setDeletingId(id);
    try {
      await eliminarPlan(id);
      toast.success('Plan eliminado correctamente');
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error eliminando plan:', error);
      toast.error(error.message || 'Error al eliminar el plan');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading || configLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
          <p className="text-slate-400 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {error && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 flex items-center gap-3 text-rose-300">
          <AlertCircle className="text-rose-400 shrink-0" size={20} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
          Gestión de Planes
        </h1>
        <p className="text-slate-400">Administra los planes de suscripción</p>
      </div>

      <div className="flex justify-end">
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 shadow-lg shadow-indigo-950/50">
          <Plus size={20} />
          Crear Plan
        </button>
      </div>

      {/* Configuración General */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl p-6">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
          <MessageCircle className="text-emerald-400" size={24} />
          <h2 className="text-xl font-bold text-white">Configuración General</h2>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="flex-1 w-full">
            <label htmlFor="whatsapp-admin" className="block text-sm font-medium text-slate-300 mb-1">
              WhatsApp del Administrador
            </label>
            <input
              id="whatsapp-admin"
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Ej: +57 324 7349128"
              className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100 placeholder-slate-500"
            />
            <p className="text-xs text-slate-400 mt-1">
              Este número se usará en el botón "Actualizar plan" para que los clientes te contacten por WhatsApp.
            </p>
          </div>
          <button
            onClick={handleGuardarWhatsapp}
            disabled={guardandoWhatsapp}
            className="btn-primary flex items-center gap-2 shrink-0 bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950/40"
          >
            <Save size={18} />
            {guardandoWhatsapp ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="bg-slate-900/80 rounded-2xl shadow-xl border border-slate-800 overflow-hidden text-slate-100">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Package className="text-indigo-400" size={24} />
            <h2 className="text-xl font-bold text-white">Planes de Suscripción</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 uppercase tracking-wider text-xs">
                <th className="px-4 py-4 text-left font-semibold">Nombre</th>
                <th className="px-4 py-4 text-left font-semibold">Precio /mes</th>
                <th className="px-4 py-4 text-center font-semibold">Duración</th>
                <th className="px-4 py-4 text-center font-semibold">Características</th>
                <th className="px-4 py-4 text-center font-semibold">Activo</th>
                <th className="px-4 py-4 text-center font-semibold">Suscripciones</th>
                <th className="px-4 py-4 text-center font-semibold">Ingreso Mensual</th>
                <th className="px-4 py-4 text-center font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {planes.length > 0 ? (
                [...planes].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(plan => {
                  const activeCount = activeSubsByPlan[plan.id] || 0;
                  const monthlyRevenue = activeCount > 0
                    ? (activeCount * plan.precio) / (plan.duracionDias / 30)
                    : 0;

                  return (
                    <tr key={plan.id} className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-white">{plan.nombre}</div>
                        {plan.descripcion && (
                          <div className="text-xs text-slate-400 mt-1 line-clamp-1">{plan.descripcion}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 font-semibold text-emerald-400">
                        {formatearDesdeBase(plan.precio)} /mes
                      </td>
                      <td className="px-4 py-4 text-center text-slate-300">
                        {plan.duracionDias} días
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="px-2.5 py-1 rounded-full bg-indigo-950/50 text-indigo-300 border border-indigo-800/40 text-xs font-semibold">
                          {plan.features.length}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${plan.activo
                            ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40'
                            : 'bg-rose-950/50 text-rose-400 border-rose-800/40'
                          }`}>
                          {plan.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold">
                          {activeCount}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center font-semibold text-cyan-300">
                        {formatearDesdeBase(monthlyRevenue)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEdit(plan)}
                            className="p-2 rounded-lg bg-indigo-950/50 text-indigo-400 hover:bg-indigo-900/60 border border-indigo-800/40 transition-colors"
                            title="Editar plan"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleToggle(plan.id, plan.activo)}
                            disabled={togglingId === plan.id || deletingId === plan.id}
                            className={`p-2 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${plan.activo
                                ? 'bg-amber-950/40 text-amber-400 border-amber-800/40 hover:bg-amber-900/60'
                                : 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40 hover:bg-emerald-900/60'
                              }`}
                            title={plan.activo ? 'Desactivar' : 'Activar'}
                          >
                            <ToggleLeft size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(plan.id)}
                            disabled={deletingId === plan.id}
                            className="p-2 rounded-lg bg-rose-950/40 text-rose-400 border border-rose-800/40 hover:bg-rose-900/60 transition-colors disabled:opacity-50"
                            title="Eliminar plan"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    <Package size={48} className="mx-auto mb-3 text-slate-700" />
                    <p className="font-medium">No hay planes creados</p>
                    <p className="text-sm mt-1">Creá tu primer plan para empezar</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <PlanForm
          plan={editingPlan}
          onClose={() => {
            setShowForm(false);
            setEditingPlan(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
