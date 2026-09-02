import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import useSuscripciones, {
  crearSuscripcion,
  actualizarSuscripcion,
  marcarPagada,
} from '../hooks/useSuscripciones';
import usePlanes from '../hooks/usePlanes';
import { useMoneda } from '../hooks/useMoneda';
import { sanitizarWhatsApp } from '../hooks/useAdminConfig';
import { parseDateToMs, formatDate } from '../utils/dateUtils';
import SuscripcionCard from '../components/SuscripcionCard';
import Paginador from '../components/Paginador';
import LoadingScreen from '../components/LoadingScreen';
import {
  CreditCard,
  Plus,
  X,
  Eye,
  AlertCircle,
  RefreshCw,
  MessageCircle,
  CheckCircle2,
  Clock,
  Search,
  Check,
  Calendar,
  Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Suscripcion, EstadoSuscripcion, PagoEstado } from '../types/suscripcion';

type CohorteVencimiento = 'todas' | 'urgente3d' | 'semana7d' | 'vencidas' | 'activas';

export default function AdminSuscripciones() {
  const { user } = useAuth();
  const { suscripciones, loading, error } = useSuscripciones(user);
  const { planes } = usePlanes(user);
  const { formatearDesdeBase } = useMoneda();

  const [filtroCohorte, setFiltroCohorte] = useState<CohorteVencimiento>('todas');
  const [filtroEstado, setFiltroEstado] = useState<EstadoSuscripcion | 'todas'>('todas');
  const [filtroPago, setFiltroPago] = useState<PagoEstado | 'todos'>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [showCreate, setShowCreate] = useState(false);
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string; correo?: string }[]>([]);
  const [createForm, setCreateForm] = useState({ usuarioId: '', planId: '', fechaInicio: '' });
  const [creating, setCreating] = useState(false);

  const [viewSuscripcion, setViewSuscripcion] = useState<Suscripcion | null>(null);
  const [marcandoPagada, setMarcandoPagada] = useState<string | null>(null);

  useEffect(() => {
    if (showCreate) {
      getDocs(collection(db, 'usuarios')).then((snapshot) => {
        setUsuarios(
          snapshot.docs.map((d) => ({
            id: d.id,
            nombre: d.data().nombre || d.data().correo || 'Sin nombre',
            correo: d.data().correo || d.data().email || '',
          }))
        );
      });
      setCreateForm({ usuarioId: '', planId: '', fechaInicio: '' });
    }
  }, [showCreate]);

  // Filtering
  const filtered = useMemo(() => {
    const now = Date.now();
    const unDiaMs = 24 * 60 * 60 * 1000;

    return suscripciones.filter((s) => {
      // Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesUser = (s.usuarioNombre || '').toLowerCase().includes(term);
        const matchesPlan = (s.planNombre || '').toLowerCase().includes(term);
        if (!matchesUser && !matchesPlan) return false;
      }

      // Estado
      if (filtroEstado !== 'todas' && s.estado !== filtroEstado) return false;

      // Pago
      if (filtroPago !== 'todos' && s.pagoEstado !== filtroPago) return false;

      // Cohorte
      if (filtroCohorte !== 'todas') {
        const finMs = parseDateToMs(s.fechaFin) || 0;
        const diff = finMs - now;

        if (filtroCohorte === 'urgente3d') {
          if (diff < 0 || diff > 3 * unDiaMs || s.estado !== 'activa') return false;
        } else if (filtroCohorte === 'semana7d') {
          if (diff < 0 || diff > 7 * unDiaMs || s.estado !== 'activa') return false;
        } else if (filtroCohorte === 'vencidas') {
          if (diff >= 0 || s.estado === 'cancelada') return false;
        } else if (filtroCohorte === 'activas') {
          if (s.estado !== 'activa' || diff < 0) return false;
        }
      }

      return true;
    });
  }, [suscripciones, searchTerm, filtroEstado, filtroPago, filtroCohorte]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filtroEstado, filtroPago, filtroCohorte]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const handleCreate = async () => {
    if (!createForm.usuarioId || !createForm.planId || !createForm.fechaInicio) {
      toast.error('Todos los campos son obligatorios');
      return;
    }

    const usuario = usuarios.find((u) => u.id === createForm.usuarioId);
    const plan = planes.find((p) => p.id === createForm.planId);
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
    setMarcandoPagada(id);
    try {
      await marcarPagada(id);
      toast.success('Pago registrado correctamente');
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error marcando como pagada:', error);
      toast.error('Error al registrar pago');
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
    const finMs = parseDateToMs(s.fechaFin) || Date.now();
    const fechaFin = new Date(finMs);
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

  const buildWhatsAppMessageLink = (s: Suscripcion) => {
    const finMs = parseDateToMs(s.fechaFin);
    const fechaFinStr = finMs
      ? new Date(finMs).toLocaleDateString('es-CO')
      : 'pronto';
    const montoStr = formatearDesdeBase(s.monto || 0);

    const diff = finMs ? finMs - Date.now() : 0;
    const diasRestantes = Math.ceil(diff / (24 * 60 * 60 * 1000));
    const diasTexto = diasRestantes <= 0 ? 'vencida' : `en ${diasRestantes} días`;

    const message = `Hola ${s.usuarioNombre}, te escribimos de *StreamControl Pro* para recordarte que tu suscripción al plan *${s.planNombre}* vence el ${fechaFinStr} (${diasTexto}).\n\n*Valor de renovación:* ${montoStr}\n\n¿Deseas que te enviemos los medios de pago disponibles para mantener tu servicio activo sin interrupciones? Quedamos atentos para ayudarte.`;

    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  const formatTimestamp = (ts?: any) => {
    return formatDate(ts);
  };

  if (loading) {
    return <LoadingScreen mensaje="Cargando suscripciones..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {error && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 flex items-center gap-3 text-rose-300">
          <AlertCircle className="text-rose-400 shrink-0" size={20} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-cyan-400">
              <CreditCard size={22} />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
                Gestión de Suscripciones & Cobranzas
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Pipeline de cobro por WhatsApp, cohortes de vencimiento y renovación proactiva
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-950/50 transition-all hover:scale-105 active:scale-95"
        >
          <Plus size={18} />
          <span>Crear Suscripción</span>
        </button>
      </div>

      {/* Tabs de Cohortes de Vencimiento */}
      <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {[
            { id: 'todas', label: 'Todas las Cohortes' },
            { id: 'urgente3d', label: 'Próximos a Vencer (≤3d)' },
            { id: 'semana7d', label: 'Esta Semana (≤7d)' },
            { id: 'vencidas', label: 'En Gracia / Vencidos' },
            { id: 'activas', label: 'Activas al Día' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFiltroCohorte(tab.id as CohorteVencimiento)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filtroCohorte === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 scale-105'
                  : 'bg-slate-950/60 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Barra de Filtros Secundarios y Búsqueda */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between pt-2 border-t border-slate-800/60">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Buscar por tenant o plan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-8 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-semibold px-2">Estado:</span>
              {(['todas', 'activa', 'expirada', 'cancelada'] as const).map((estado) => (
                <button
                  key={estado}
                  onClick={() => setFiltroEstado(estado)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    filtroEstado === estado
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {estado === 'todas' ? 'Todos' : estado.charAt(0).toUpperCase() + estado.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-semibold px-2">Pago:</span>
              {(['todos', 'pagado', 'pendiente', 'vencido'] as const).map((pago) => (
                <button
                  key={pago}
                  onClick={() => setFiltroPago(pago)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    filtroPago === pago
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {pago === 'todos' ? 'Todos' : pago.charAt(0).toUpperCase() + pago.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Suscripciones Dark SaaS */}
      <div className="bg-slate-900/80 rounded-2xl shadow-xl border border-slate-800/80 overflow-hidden text-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 uppercase tracking-wider text-xs font-semibold">
                <th className="px-6 py-4">Tenant / Usuario</th>
                <th className="px-4 py-4">Plan Contratado</th>
                <th className="px-4 py-4">Período (Inicio – Fin)</th>
                <th className="px-4 py-4 text-center">Estado</th>
                <th className="px-4 py-4 text-center">Estado Pago</th>
                <th className="px-4 py-4 text-right">Monto</th>
                <th className="px-6 py-4 text-center">Acciones & Cobranza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {paginated.length > 0 ? (
                paginated.map((s) => {
                  const estadoStyles: Record<string, string> = {
                    activa: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50',
                    expirada: 'bg-slate-800 text-slate-400 border-slate-700',
                    cancelada: 'bg-rose-950/60 text-rose-400 border-rose-800/50',
                  };
                  const pagoStyles: Record<string, string> = {
                    pagado: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50',
                    pendiente: 'bg-amber-950/60 text-amber-400 border-amber-800/50',
                    vencido: 'bg-rose-950/60 text-rose-400 border-rose-800/50',
                  };

                  return (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-white">
                        {s.usuarioNombre}
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2.5 py-1 rounded-full bg-indigo-950/60 text-cyan-300 border border-indigo-800/50 text-xs font-semibold">
                          {s.planNombre}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-300">
                        <div>{formatTimestamp(s.fechaInicio)}</div>
                        <div className="text-slate-500">hasta {formatTimestamp(s.fechaFin)}</div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${estadoStyles[s.estado] || ''}`}>
                          {s.estado === 'activa' ? 'Activa' : s.estado === 'expirada' ? 'Expirada' : 'Cancelada'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${pagoStyles[s.pagoEstado] || ''}`}>
                          {s.pagoEstado ? s.pagoEstado.toUpperCase() : 'PENDIENTE'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-emerald-400">
                        {formatearDesdeBase(s.monto || 0)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* Botón WhatsApp Cobranza */}
                          <a
                            href={buildWhatsAppMessageLink(s)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 transition-all hover:scale-105"
                            title="Cobrar vía WhatsApp"
                          >
                            <MessageCircle size={14} />
                            <span>Cobrar</span>
                          </a>

                          {/* Registrar Pago */}
                          {s.pagoEstado !== 'pagado' && (
                            <button
                              onClick={() => handleMarcarPagada(s.id)}
                              disabled={marcandoPagada === s.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/50 text-cyan-300 text-xs font-semibold transition-all"
                              title="Registrar pago realizado"
                            >
                              <Check size={14} />
                              <span>{marcandoPagada === s.id ? '...' : 'Pagado'}</span>
                            </button>
                          )}

                          {/* Quick selectors for Status */}
                          <select
                            value={s.estado}
                            onChange={(e) => handleChangeEstado(s.id, e.target.value as EstadoSuscripcion)}
                            className="text-[11px] border border-slate-700 rounded-lg px-2 py-1 bg-slate-950 text-slate-200"
                          >
                            <option value="activa">Activa</option>
                            <option value="expirada">Expirada</option>
                            <option value="cancelada">Cancelada</option>
                          </select>

                          {/* Renovar */}
                          <button
                            onClick={() => handleRenovar(s)}
                            className="p-1.5 rounded-lg bg-amber-950/50 text-amber-400 border border-amber-800/40 hover:bg-amber-900 transition-colors"
                            title="Renovar ciclo"
                          >
                            <RefreshCw size={14} />
                          </button>

                          {/* Ver Detalle */}
                          <button
                            onClick={() => setViewSuscripcion(s)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                            title="Ver tarjeta completa"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-500">
                    <CreditCard size={48} className="mx-auto mb-3 text-slate-700" />
                    <p className="font-semibold text-slate-400">No hay suscripciones registradas</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Creá una nueva suscripción para comenzar
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {filtered.length > itemsPerPage && (
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
            <Paginador
              currentPage={currentPage}
              totalItems={filtered.length}
              itemsPerPage={itemsPerPage}
              onPageChange={(page) => setCurrentPage(page)}
              onItemsPerPageChange={(limit) => {
                setItemsPerPage(limit);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* Modal Crear Suscripción */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-2xl font-bold text-white">Crear Suscripción</h2>
                <p className="text-slate-400 mt-0.5 text-xs">Asignar un plan de cobro a un tenant</p>
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
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Tenant / Usuario <span className="text-rose-400">*</span>
                </label>
                <select
                  value={createForm.usuarioId}
                  onChange={(e) => setCreateForm({ ...createForm, usuarioId: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 cursor-pointer"
                >
                  <option value="">Seleccionar usuario...</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} ({u.correo || 'sin correo'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Plan a Asignar <span className="text-rose-400">*</span>
                </label>
                <select
                  value={createForm.planId}
                  onChange={(e) => setCreateForm({ ...createForm, planId: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 cursor-pointer"
                >
                  <option value="">Seleccionar plan...</option>
                  {planes
                    .filter((p) => p.activo)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} — {formatearDesdeBase(p.precio)} ({p.duracionDias} días)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Fecha de Inicio de Ciclo <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={createForm.fechaInicio}
                  onChange={(e) => setCreateForm({ ...createForm, fechaInicio: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="btn-secondary flex-1 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="btn-primary flex-1 text-sm shadow-lg shadow-indigo-950/50"
                >
                  {creating ? 'Guardando...' : 'Crear Suscripción'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle de Suscripción */}
      {viewSuscripcion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-2xl font-bold text-white">Detalle de Suscripción</h2>
                <p className="text-slate-400 mt-0.5 text-xs">{viewSuscripcion.usuarioNombre}</p>
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
