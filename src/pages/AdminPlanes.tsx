import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import usePlanes, { crearPlan, actualizarPlan, togglePlanActive, eliminarPlan } from '../hooks/usePlanes';
import useSuscripciones from '../hooks/useSuscripciones';
import PlanForm from '../components/PlanForm';
import { Package, Plus, Edit, ToggleLeft, Trash2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Plan, PlanInput } from '../types/plan';

export default function AdminPlanes() {
  const { user } = useAuth();
  const { planes, loading, error } = usePlanes(user);
  const { suscripciones } = useSuscripciones(user);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    try {
      await togglePlanActive(id, current);
      toast.success(`Plan ${current ? 'desactivado' : 'activado'} correctamente`);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error toggling plan:', error);
      toast.error('Error al cambiar estado del plan');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando planes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-red-500 shrink-0" size={20} />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600">
          Gestión de Planes
        </h1>
        <p className="text-gray-600">Administra los planes de suscripción</p>
      </div>

      <div className="flex justify-end">
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          Crear Plan
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Package className="text-indigo-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Planes de Suscripción</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                <th className="px-4 py-4 text-left text-sm font-semibold">Nombre</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Precio</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Duración</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Características</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Activo</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Suscripciones</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Ingreso Mensual</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {planes.length > 0 ? (
                planes.map(plan => {
                  const activeCount = activeSubsByPlan[plan.id] || 0;
                  const monthlyRevenue = activeCount > 0
                    ? (activeCount * plan.precio) / (plan.duracionDias / 30)
                    : 0;

                  return (
                    <tr key={plan.id} className="border-b border-gray-100 hover:bg-indigo-50/30 transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-gray-900">{plan.nombre}</div>
                        {plan.descripcion && (
                          <div className="text-xs text-gray-500 mt-1 line-clamp-1">{plan.descripcion}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 font-medium text-gray-900">
                        ${plan.precio.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-center text-gray-700">
                        {plan.duracionDias} días
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium">
                          {plan.features.length}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${plan.activo
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                          {plan.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                          {activeCount}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center font-medium text-green-700">
                        ${monthlyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEdit(plan)}
                            className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                            title="Editar plan"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleToggle(plan.id, plan.activo)}
                            className={`p-2 rounded-lg transition-colors ${plan.activo
                                ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                                : 'bg-green-100 text-green-600 hover:bg-green-200'
                              }`}
                            title={plan.activo ? 'Desactivar' : 'Activar'}
                          >
                            <ToggleLeft size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(plan.id)}
                            disabled={deletingId === plan.id}
                            className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50"
                            title="Eliminar plan"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500">
                    <Package size={48} className="mx-auto mb-3 text-gray-300" />
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
