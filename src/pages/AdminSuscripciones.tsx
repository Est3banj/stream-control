import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import useSuscripciones, { crearSuscripcion, actualizarSuscripcion, marcarPagada } from '../hooks/useSuscripciones';
import usePlanes from '../hooks/usePlanes';
import SuscripcionCard from '../components/SuscripcionCard';
import { CreditCard, Plus, X, Eye, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Suscripcion, EstadoSuscripcion, PagoEstado } from '../types/suscripcion';

export default function AdminSuscripciones() {
  const { user } = useAuth();
  const { suscripciones, loading, error } = useSuscripciones(user);
  const { planes } = usePlanes(user);

  const [filtroEstado, setFiltroEstado] = useState<EstadoSuscripcion | 'todas'>('todas');
  const [filtroPago, setFiltroPago] = useState<PagoEstado | 'todos'>('todos');

  const [showCreate, setShowCreate] = useState(false);
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string }[]>([]);
  const [createForm, setCreateForm] = useState({ usuarioId: '', planId: '', fechaInicio: '' });
  const [creating, setCreating] = useState(false);

  const [viewSuscripcion, setViewSuscripcion] = useState<Suscripcion | null>(null);

  useEffect(() => {
    if (showCreate) {
      getDocs(collection(db, 'usuarios')).then(snapshot => {
        setUsuarios(snapshot.docs.map(d => ({ id: d.id, nombre: d.data().nombre })));
      });
      setCreateForm({ usuarioId: '', planId: '', fechaInicio: '' });
    }
  }, [showCreate]);

  const filtered = suscripciones.filter(s => {
    if (filtroEstado !== 'todas' && s.estado !== filtroEstado) return false;
    if (filtroPago !== 'todos' && s.pagoEstado !== filtroPago) return false;
    return true;
  });

  const handleCreate = async () => {
    if (!createForm.usuarioId || !createForm.planId || !createForm.fechaInicio) {
      toast.error('Todos los campos son obligatorios');
      return;
    }

    const usuario = usuarios.find(u => u.id === createForm.usuarioId);
    const plan = planes.find(p => p.id === createForm.planId);
    if (!usuario || !plan) return;

    const fechaInicioDate = new Date(createForm.fechaInicio + 'T00:00:00');
    const fechaFinDate = new Date(fechaInicioDate);
    fechaFinDate.setDate(fechaFinDate.getDate() + plan.duracionDias);

    setCreating(true);
    try {
      await crearSuscripcion({
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        planId: plan.id,
        planNombre: plan.nombre,
        fechaInicio: Timestamp.fromDate(fechaInicioDate),
        fechaFin: Timestamp.fromDate(fechaFinDate),
        estado: 'activa',
        pagoEstado: 'pendiente',
        monto: plan.precio,
      });
      toast.success('Suscripción creada correctamente');
      setShowCreate(false);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error creando suscripción:', error);
      toast.error(error.message || 'Error al crear la suscripción');
    } finally {
      setCreating(false);
    }
  };

  const handleMarcarPagada = async (id: string) => {
    try {
      await marcarPagada(id);
      toast.success('Suscripción marcada como pagada');
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error marcando como pagada:', error);
      toast.error('Error al marcar como pagada');
    }
  };

  const handleChangeEstado = async (id: string, estado: EstadoSuscripcion) => {
    try {
      await actualizarSuscripcion(id, { estado });
      toast.success('Estado actualizado correctamente');
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error actualizando estado:', error);
      toast.error('Error al actualizar el estado');
    }
  };

  const handleChangePago = async (id: string, pagoEstado: PagoEstado) => {
    try {
      await actualizarSuscripcion(id, { pagoEstado });
      toast.success('Estado de pago actualizado correctamente');
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error actualizando pago:', error);
      toast.error('Error al actualizar el estado de pago');
    }
  };

  const handleRenovar = (s: Suscripcion) => {
    const fechaFin = new Date(s.fechaFin.seconds * 1000);
    const nextDay = new Date(fechaFin);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];

    setCreateForm({
      usuarioId: s.usuarioId,
      planId: s.planId,
      fechaInicio: nextDayStr,
    });
    setShowCreate(true);
  };

  const formatTimestamp = (ts: Timestamp) => {
    return new Date(ts.seconds * 1000).toLocaleDateString('es-CO');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando suscripciones...</p>
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
          Gestión de Suscripciones
        </h1>
        <p className="text-gray-600">Administra las suscripciones de los usuarios</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {(['todas', 'activa', 'expirada', 'cancelada'] as const).map((estado) => (
              <button
                key={estado}
                onClick={() => setFiltroEstado(estado)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filtroEstado === estado
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg'
                    : 'bg-white/80 text-gray-700 hover:bg-white'
                  }`}
              >
                {estado === 'todas' ? 'Todas' : estado.charAt(0).toUpperCase() + estado.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            {(['todos', 'pagado', 'pendiente', 'vencido'] as const).map((pago) => (
              <button
                key={pago}
                onClick={() => setFiltroPago(pago)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filtroPago === pago
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg'
                    : 'bg-white/80 text-gray-700 hover:bg-white'
                  }`}
              >
                {pago === 'todos' ? 'Todos' : pago.charAt(0).toUpperCase() + pago.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            <Plus size={18} />
            Crear Suscripción
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                <th className="px-4 py-4 text-left text-sm font-semibold">Usuario</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Plan</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Inicio</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Fin</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Estado</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Pago</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Monto</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map(s => {
                  const estadoStyles: Record<string, string> = {
                    activa: 'bg-green-100 text-green-700',
                    expirada: 'bg-gray-100 text-gray-700',
                    cancelada: 'bg-red-100 text-red-700',
                  };
                  const pagoStyles: Record<string, string> = {
                    pagado: 'bg-green-100 text-green-700',
                    pendiente: 'bg-yellow-100 text-yellow-700',
                    vencido: 'bg-red-100 text-red-700',
                  };

                  return (
                    <tr key={s.id} className="border-b border-gray-100 hover:bg-indigo-50/30 transition-colors">
                      <td className="px-4 py-4 font-medium text-gray-900">{s.usuarioNombre}</td>
                      <td className="px-4 py-4">
                        <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium">
                          {s.planNombre}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-700 text-sm">
                        {formatTimestamp(s.fechaInicio)}
                      </td>
                      <td className="px-4 py-4 text-gray-700 text-sm">
                        {formatTimestamp(s.fechaFin)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${estadoStyles[s.estado]}`}>
                          {s.estado === 'activa' ? 'Activa' : s.estado === 'expirada' ? 'Expirada' : 'Cancelada'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${pagoStyles[s.pagoEstado]}`}>
                          {s.pagoEstado === 'pagado' ? 'Pagado' : s.pagoEstado === 'pendiente' ? 'Pendiente' : 'Vencido'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center font-semibold text-gray-900">
                        ${s.monto.toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <select
                            value={s.estado}
                            onChange={(e) => handleChangeEstado(s.id, e.target.value as EstadoSuscripcion)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                          >
                            <option value="activa">Activa</option>
                            <option value="expirada">Expirada</option>
                            <option value="cancelada">Cancelada</option>
                          </select>
                          <select
                            value={s.pagoEstado}
                            onChange={(e) => handleChangePago(s.id, e.target.value as PagoEstado)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                          >
                            <option value="pagado">Pagado</option>
                            <option value="pendiente">Pendiente</option>
                            <option value="vencido">Vencido</option>
                          </select>
                          <button
                            onClick={() => handleRenovar(s)}
                            className="p-2 rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors"
                            title="Renovar suscripción"
                          >
                            <RefreshCw size={18} />
                          </button>
                          <button
                            onClick={() => setViewSuscripcion(s)}
                            className="p-2 rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors"
                            title="Ver detalles"
                          >
                            <Eye size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500">
                    <CreditCard size={48} className="mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">No hay suscripciones registradas</p>
                    <p className="text-sm mt-1">Creá una suscripción para empezar</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card max-w-lg w-full animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Crear Suscripción</h2>
                <p className="text-gray-600 mt-1">Asigná un plan a un usuario</p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Usuario <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.usuarioId}
                  onChange={(e) => setCreateForm({ ...createForm, usuarioId: e.target.value })}
                  className="w-full"
                >
                  <option value="">Seleccionar usuario...</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Plan <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.planId}
                  onChange={(e) => setCreateForm({ ...createForm, planId: e.target.value })}
                  className="w-full"
                >
                  <option value="">Seleccionar plan...</option>
                  {planes.filter(p => p.activo).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} - ${p.precio.toLocaleString()} ({p.duracionDias} días)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Fecha de inicio <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={createForm.fechaInicio}
                  onChange={(e) => setCreateForm({ ...createForm, fechaInicio: e.target.value })}
                  className="w-full"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="btn-primary flex-1"
                >
                  {creating ? 'Creando...' : 'Crear Suscripción'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewSuscripcion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card max-w-2xl w-full animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Detalle de Suscripción</h2>
                <p className="text-gray-600 mt-1">{viewSuscripcion.usuarioNombre}</p>
              </div>
              <button
                onClick={() => setViewSuscripcion(null)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>
            <SuscripcionCard
              suscripcion={viewSuscripcion}
              onMarcarPagada={handleMarcarPagada}
            />
          </div>
        </div>
      )}
    </div>
  );
}
