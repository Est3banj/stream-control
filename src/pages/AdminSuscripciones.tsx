import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import useSuscripciones, { crearSuscripcion, actualizarSuscripcion, marcarPagada } from '../hooks/useSuscripciones';
import usePlanes from '../hooks/usePlanes';
import { useMoneda } from '../hooks/useMoneda';
import SuscripcionCard from '../components/SuscripcionCard';
import { CreditCard, Plus, X, Eye, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Suscripcion, EstadoSuscripcion, PagoEstado } from '../types/suscripcion';

export default function AdminSuscripciones() {
  const { user } = useAuth();
  const { suscripciones, loading, error } = useSuscripciones(user);
  const { planes } = usePlanes(user);
  const { formatearDesdeBase } = useMoneda();

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

  const [marcandoPagada, setMarcandoPagada] = useState<string | null>(null);

  const handleMarcarPagada = async (id: string) => {
    setMarcandoPagada(id);
    try {
      await marcarPagada(id);
      toast.success('Suscripción marcada como pagada');
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error marcando como pagada:', error);
      toast.error('Error al marcar como pagada');
    } finally {
      setMarcandoPagada(null);
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
      <div className="flex items-center justify-center min-h-[60vh] text-slate-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
          <p className="text-slate-400 font-medium">Cargando suscripciones...</p>
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
          Gestión de Suscripciones
        </h1>
        <p className="text-slate-400">Administra las suscripciones de los usuarios</p>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl p-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {(['todas', 'activa', 'expirada', 'cancelada'] as const).map((estado) => (
              <button
                key={estado}
                onClick={() => setFiltroEstado(estado)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filtroEstado === estado
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/50'
                    : 'bg-slate-950/60 text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white'
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
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/50'
                    : 'bg-slate-950/60 text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                {pago === 'todos' ? 'Todos' : pago.charAt(0).toUpperCase() + pago.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2 whitespace-nowrap shadow-lg shadow-indigo-950/50"
          >
            <Plus size={18} />
            Crear Suscripción
          </button>
        </div>
      </div>

      <div className="bg-slate-900/80 rounded-2xl shadow-xl border border-slate-800 overflow-hidden text-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 uppercase tracking-wider text-xs">
                <th className="px-4 py-4 text-left font-semibold">Usuario</th>
                <th className="px-4 py-4 text-left font-semibold">Plan</th>
                <th className="px-4 py-4 text-left font-semibold">Inicio</th>
                <th className="px-4 py-4 text-left font-semibold">Fin</th>
                <th className="px-4 py-4 text-center font-semibold">Estado</th>
                <th className="px-4 py-4 text-center font-semibold">Pago</th>
                <th className="px-4 py-4 text-center font-semibold">Monto</th>
                <th className="px-4 py-4 text-center font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map(s => {
                  const estadoStyles: Record<string, string> = {
                    activa: 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40',
                    expirada: 'bg-slate-800 text-slate-400 border-slate-700',
                    cancelada: 'bg-rose-950/50 text-rose-400 border-rose-800/40',
                  };
                  const pagoStyles: Record<string, string> = {
                    pagado: 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40',
                    pendiente: 'bg-amber-950/50 text-amber-400 border-amber-800/40',
                    vencido: 'bg-rose-950/50 text-rose-400 border-rose-800/40',
                  };

                  return (
                    <tr key={s.id} className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-4 font-medium text-white">{s.usuarioNombre}</td>
                      <td className="px-4 py-4">
                        <span className="px-2.5 py-1 rounded-full bg-indigo-950/50 text-cyan-300 border border-indigo-800/40 text-xs font-semibold">
                          {s.planNombre}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-300 text-sm">
                        {formatTimestamp(s.fechaInicio)}
                      </td>
                      <td className="px-4 py-4 text-slate-300 text-sm">
                        {formatTimestamp(s.fechaFin)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${estadoStyles[s.estado]}`}>
                          {s.estado === 'activa' ? 'Activa' : s.estado === 'expirada' ? 'Expirada' : 'Cancelada'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${pagoStyles[s.pagoEstado]}`}>
                          {s.pagoEstado === 'pagado' ? 'Pagado' : s.pagoEstado === 'pendiente' ? 'Pendiente' : 'Vencido'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center font-semibold text-emerald-400">
                        {formatearDesdeBase(s.monto)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <select
                            value={s.estado}
                            onChange={(e) => handleChangeEstado(s.id, e.target.value as EstadoSuscripcion)}
                            className="text-xs border border-slate-700 rounded-xl px-2 py-1.5 bg-slate-900 text-slate-200"
                          >
                            <option value="activa">Activa</option>
                            <option value="expirada">Expirada</option>
                            <option value="cancelada">Cancelada</option>
                          </select>
                          <select
                            value={s.pagoEstado}
                            onChange={(e) => handleChangePago(s.id, e.target.value as PagoEstado)}
                            className="text-xs border border-slate-700 rounded-xl px-2 py-1.5 bg-slate-900 text-slate-200"
                          >
                            <option value="pagado">Pagado</option>
                            <option value="pendiente">Pendiente</option>
                            <option value="vencido">Vencido</option>
                          </select>
                          <button
                            onClick={() => handleRenovar(s)}
                            className="p-2 rounded-xl bg-amber-950/40 text-amber-400 border border-amber-800/40 hover:bg-amber-900/60 transition-colors"
                            title="Renovar suscripción"
                          >
                            <RefreshCw size={16} />
                          </button>
                          <button
                            onClick={() => setViewSuscripcion(s)}
                            className="p-2 rounded-xl bg-indigo-950/50 text-indigo-400 border border-indigo-800/40 hover:bg-indigo-900/60 transition-colors"
                            title="Ver detalles"
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    <CreditCard size={48} className="mx-auto mb-3 text-slate-700" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-2xl font-bold text-white">Crear Suscripción</h2>
                <p className="text-slate-400 mt-1 text-sm">Asigná un plan a un usuario</p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Usuario <span className="text-rose-400">*</span>
                </label>
                <select
                  value={createForm.usuarioId}
                  onChange={(e) => setCreateForm({ ...createForm, usuarioId: e.target.value })}
                  className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 transition-all duration-150 appearance-none cursor-pointer"
                >
                  <option value="">Seleccionar usuario...</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Plan <span className="text-rose-400">*</span>
                </label>
                <select
                  value={createForm.planId}
                  onChange={(e) => setCreateForm({ ...createForm, planId: e.target.value })}
                  className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 transition-all duration-150 appearance-none cursor-pointer"
                >
                  <option value="">Seleccionar plan...</option>
                  {planes.filter(p => p.activo).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} - {formatearDesdeBase(p.precio)} ({p.duracionDias} días)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Fecha de inicio <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={createForm.fechaInicio}
                  onChange={(e) => setCreateForm({ ...createForm, fechaInicio: e.target.value })}
                  className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 transition-all duration-150"
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
                  className="btn-primary flex-1 shadow-lg shadow-indigo-950/50"
                >
                  {creating ? 'Creando...' : 'Crear Suscripción'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewSuscripcion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-2xl font-bold text-white">Detalle de Suscripción</h2>
                <p className="text-slate-400 mt-1 text-sm">{viewSuscripcion.usuarioNombre}</p>
              </div>
              <button
                onClick={() => setViewSuscripcion(null)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <SuscripcionCard
              suscripcion={viewSuscripcion}
              onMarcarPagada={handleMarcarPagada}
              cargandoId={marcandoPagada}
            />
          </div>
        </div>
      )}
    </div>
  );
}
