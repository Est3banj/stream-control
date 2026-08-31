import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAdminMetrics, type ExpirationItem } from '../hooks/useAdminMetrics';
import { useMoneda } from '../hooks/useMoneda';
import { useBroadcastBanner, type BroadcastConfig } from '../hooks/useBroadcastBanner';
import { actualizarSuscripcion } from '../hooks/useSuscripciones';
import { sanitizarWhatsApp } from '../hooks/useAdminConfig';
import {
  DollarSign,
  Users,
  CreditCard,
  AlertCircle,
  TrendingUp,
  Megaphone,
  MessageCircle,
  CalendarPlus,
  ArrowUpRight,
  X,
  Send,
  PieChart as PieIcon,
  Activity,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

const DONUT_COLORS = ['#6366f1', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];

export default function AdminDashboard() {
  const { user } = useAuth();
  const {
    mrr,
    arr,
    arpu,
    totalUsuarios,
    totalTenants,
    usuariosVerificados,
    porcentajeVerificados,
    activeTenantsCount,
    tasaConversion,
    carteraPendiente,
    totalPendientesCount,
    todasExpiraciones,
    distribucionPlanes,
    timelineCrecimiento,
    loading,
    error,
  } = useAdminMetrics(user);

  const { formatearDesdeBase } = useMoneda();
  const { broadcast, updateBroadcast, clearBroadcast } = useBroadcastBanner();

  // Cohort filter for Action Center
  const [cohortFilter, setCohortFilter] = useState<'riesgo' | 'urgente' | 'mora'>('riesgo');

  // Broadcast modal state
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState<{
    mensaje: string;
    tipo: 'info' | 'warning' | 'critical';
    activo: boolean;
  }>({
    mensaje: broadcast.mensaje || broadcast.message || '',
    tipo: (broadcast.tipo || broadcast.type || 'info') as 'info' | 'warning' | 'critical',
    activo: Boolean(broadcast.activo || broadcast.active),
  });
  const [savingBroadcast, setSavingBroadcast] = useState(false);
  const [extendingId, setExtendingId] = useState<string | null>(null);

  const handleOpenBroadcastModal = () => {
    setBroadcastForm({
      mensaje: broadcast.mensaje || broadcast.message || '',
      tipo: (broadcast.tipo || broadcast.type || 'info') as 'info' | 'warning' | 'critical',
      activo: Boolean(broadcast.activo || broadcast.active),
    });
    setShowBroadcastModal(true);
  };

  const handleSaveBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBroadcast(true);
    try {
      await updateBroadcast({
        activo: broadcastForm.activo,
        mensaje: broadcastForm.mensaje,
        tipo: broadcastForm.tipo,
        usuarioEmail: user?.email || 'admin',
      });
      toast.success('Anuncio global actualizado correctamente');
      setShowBroadcastModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar anuncio global');
    } finally {
      setSavingBroadcast(false);
    }
  };

  const handleClearBroadcast = async () => {
    setSavingBroadcast(true);
    try {
      await clearBroadcast(user?.email || 'admin');
      setBroadcastForm({ mensaje: '', tipo: 'info', activo: false });
      toast.success('Anuncio global desactivado');
      setShowBroadcastModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Error al desactivar anuncio');
    } finally {
      setSavingBroadcast(false);
    }
  };

  // Grace extension (+7 days)
  const handleExtenderGracia = async (item: ExpirationItem) => {
    const s = item.suscripcion;
    setExtendingId(s.id);
    try {
      const currentFin = s.fechaFin?.seconds ? new Date(s.fechaFin.seconds * 1000) : new Date();
      const baseDate = currentFin > new Date() ? currentFin : new Date();
      const newFin = new Date(baseDate);
      newFin.setDate(newFin.getDate() + 7);

      await actualizarSuscripcion(s.id, {
        fechaFin: Timestamp.fromDate(newFin),
        estado: 'activa',
      });
      toast.success(`Suscripción de ${s.usuarioNombre} extendida +7 días`);
    } catch (err) {
      console.error(err);
      toast.error('Error al extender suscripción');
    } finally {
      setExtendingId(null);
    }
  };

  // Build WhatsApp Reminder URL
  const buildWhatsAppLink = (item: ExpirationItem) => {
    const s = item.suscripcion;
    const u = item.usuario;
    const phone = u?.correo ? '' : ''; // fallback if phone stored
    const fecha = s.fechaFin?.seconds
      ? new Date(s.fechaFin.seconds * 1000).toLocaleDateString('es-CO', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'pronto';
    const montoStr = formatearDesdeBase(s.monto || 0);

    const message = `👋 ¡Hola ${s.usuarioNombre || 'Cliente'}! Te escribimos de *StreamControl Pro* para recordarte que tu suscripción al plan *${s.planNombre}* vence el ${fecha} (${item.diasRestantes <= 0 ? 'vencida' : `en ${item.diasRestantes} días`}).\n\n💰 *Monto de renovación:* ${montoStr}\n\n¿Deseas renovar tu acceso y recibir los medios de pago disponibles? Quedamos a tu disposición para mantener tu servicio sin interrupciones. 🚀`;

    const cleanPhone = sanitizarWhatsApp(phone || '');
    if (cleanPhone) {
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    }
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  // Filtered expirations
  const filteredExpirations = todasExpiraciones.filter((item) => {
    if (cohortFilter === 'urgente') return item.diasRestantes >= 0 && item.diasRestantes <= 3;
    if (cohortFilter === 'mora') return item.esMora;
    return true; // 'riesgo' (all <= 7 days or overdue)
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4" />
          <p className="text-slate-400 font-medium">Cargando métricas ejecutivas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in text-slate-100">
      {error && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 flex items-center gap-3 text-rose-300">
          <AlertCircle className="text-rose-400 shrink-0" size={20} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Header Ejecutivo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Activity size={22} />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
                Panel Ejecutivo SaaS
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Control financiero global, retención de suscriptores y telemetría de plataforma
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenBroadcastModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/30 hover:border-indigo-500/60 text-cyan-300 text-sm font-semibold transition-all shadow-lg shadow-indigo-950/50 hover:scale-105 active:scale-95"
          >
            <Megaphone size={18} className="text-cyan-400" />
            <span>Alerta Global</span>
            {Boolean(broadcast.activo || broadcast.active) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Grid de Tarjetas KPI Dark SaaS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: MRR */}
        <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/40">
              <DollarSign size={24} />
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
              ARR: {formatearDesdeBase(arr)}
            </span>
          </div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            MRR Recurrente Mensual
          </p>
          <p className="text-2xl sm:text-3xl font-extrabold text-white mt-1 tracking-tight">
            {formatearDesdeBase(mrr)}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-emerald-400 font-semibold">ARPU:</span>
            <span>{formatearDesdeBase(arpu)} / suscriptor</span>
          </div>
        </div>

        {/* Card 2: Suscriptores Activos */}
        <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-indigo-500/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/20 transition-all" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-950/40">
              <CreditCard size={24} />
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-800/50">
              {tasaConversion.toFixed(1)}% Conversión
            </span>
          </div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Suscriptores Activos
          </p>
          <p className="text-2xl sm:text-3xl font-extrabold text-white mt-1 tracking-tight">
            {activeTenantsCount}{' '}
            <span className="text-sm font-normal text-slate-400">de {totalTenants} tenants</span>
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <CheckCircle2 size={14} className="text-indigo-400" />
            <span>Base comercial activa y al día</span>
          </div>
        </div>

        {/* Card 3: Total Usuarios Registrados */}
        <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-cyan-500/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/20 transition-all" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-950/40">
              <Users size={24} />
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-950/60 text-cyan-300 border border-cyan-800/50">
              {porcentajeVerificados.toFixed(0)}% Verificados
            </span>
          </div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Directorio de Usuarios
          </p>
          <p className="text-2xl sm:text-3xl font-extrabold text-white mt-1 tracking-tight">
            {totalUsuarios.toLocaleString()}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-cyan-400 font-semibold">{usuariosVerificados}</span>
            <span>verificados por email</span>
          </div>
        </div>

        {/* Card 4: Cartera Pendiente por Cobrar */}
        <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/20 transition-all" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-950/40">
              <Clock size={24} />
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/50">
              {totalPendientesCount} pendientes
            </span>
          </div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Cartera por Cobrar
          </p>
          <p className="text-2xl sm:text-3xl font-extrabold text-white mt-1 tracking-tight">
            {formatearDesdeBase(carteraPendiente)}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-amber-400 font-semibold">Oportunidad:</span>
            <span>Cobro inmediato en 1-click</span>
          </div>
        </div>
      </div>

      {/* Gráficos Recharts Dark Mode */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico 1: Curva de Crecimiento */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="text-indigo-400" size={22} />
              <div>
                <h2 className="text-lg font-bold text-white">Curva de Crecimiento e Ingresos</h2>
                <p className="text-xs text-slate-400">Evolución de usuarios registrados y facturación</p>
              </div>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={timelineCrecimiento}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis
                  dataKey="mes"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                  }}
                  itemStyle={{ color: '#818cf8', fontWeight: 600 }}
                  formatter={(val: any, name: any) => [
                    name === 'ingresos' ? formatearDesdeBase(Number(val) || 0) : val,
                    name === 'ingresos' ? 'Ingresos Recaudados' : 'Usuarios Totales',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="ingresos"
                  stroke="#6366f1"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorIngresos)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Distribución por Plan */}
        <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <PieIcon className="text-cyan-400" size={22} />
              <div>
                <h2 className="text-lg font-bold text-white">Distribución por Plan</h2>
                <p className="text-xs text-slate-400">Suscripciones activas por nivel</p>
              </div>
            </div>

            <div className="h-[220px] w-full mt-2">
              {distribucionPlanes.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribucionPlanes}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {distribucionPlanes.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        color: '#f8fafc',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                      }}
                      itemStyle={{ color: '#38bdf8', fontWeight: 600 }}
                      formatter={(val: any) => [`${val} suscriptores`, 'Cantidad']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                  Sin suscripciones registradas
                </div>
              )}
            </div>
          </div>

          {/* Legend pills */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800">
            {distribucionPlanes.map((plan, i) => (
              <div
                key={plan.name}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                />
                <span className="font-medium">{plan.name}:</span>
                <span className="font-bold text-white">{plan.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Center: Cobranza Inmediata & Próximos Vencimientos */}
      <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Clock size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Action Center: Cobranza & Vencimientos</h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Contactá a clientes con suscripción por vencer o en mora vía WhatsApp en 1-clic
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setCohortFilter('riesgo')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                cohortFilter === 'riesgo'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos (≤ 7d)
            </button>
            <button
              onClick={() => setCohortFilter('urgente')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                cohortFilter === 'urgente'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Urgentes (≤ 3d)
            </button>
            <button
              onClick={() => setCohortFilter('mora')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                cohortFilter === 'mora'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              En Mora / Vencidos
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 uppercase tracking-wider text-xs font-semibold">
                <th className="px-6 py-4">Tenant / Usuario</th>
                <th className="px-4 py-4">Plan</th>
                <th className="px-4 py-4">Vence En</th>
                <th className="px-4 py-4 text-center">Estado Pago</th>
                <th className="px-4 py-4 text-right">Monto</th>
                <th className="px-6 py-4 text-center">Acciones Inmediatas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {filteredExpirations.length > 0 ? (
                filteredExpirations.map((item) => {
                  const s = item.suscripcion;
                  const fechaStr = s.fechaFin?.seconds
                    ? new Date(s.fechaFin.seconds * 1000).toLocaleDateString('es-CO')
                    : 'Sin fecha';

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{s.usuarioNombre}</div>
                        <div className="text-xs text-slate-400 font-mono">
                          {item.usuario?.correo || 'Usuario'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-950/60 text-cyan-300 border border-indigo-800/50">
                          {s.planNombre}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          {item.esMora ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-950/60 text-rose-400 border border-rose-800/50">
                              Vencida hace {Math.abs(item.diasRestantes)} d
                            </span>
                          ) : item.diasRestantes <= 3 ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/60 text-amber-300 border border-amber-800/50">
                              Vence en {item.diasRestantes} d ({fechaStr})
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">
                              {fechaStr} ({item.diasRestantes} días)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            s.pagoEstado === 'pagado'
                              ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40'
                              : s.pagoEstado === 'pendiente'
                              ? 'bg-amber-950/50 text-amber-400 border-amber-800/40'
                              : 'bg-rose-950/50 text-rose-400 border-rose-800/40'
                          }`}
                        >
                          {s.pagoEstado ? s.pagoEstado.toUpperCase() : 'PENDIENTE'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-emerald-400">
                        {formatearDesdeBase(s.monto || 0)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <a
                            href={buildWhatsAppLink(item)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 transition-all hover:scale-105 active:scale-95"
                            title="Cobrar vía WhatsApp"
                          >
                            <MessageCircle size={15} />
                            <span>Cobrar WhatsApp</span>
                          </a>

                          <button
                            onClick={() => handleExtenderGracia(item)}
                            disabled={extendingId === s.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-all"
                            title="Dar 7 días de gracia"
                          >
                            <CalendarPlus size={14} className="text-cyan-400" />
                            <span>+7d Gracia</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    <CheckCircle2 size={40} className="mx-auto mb-2 text-emerald-500/40" />
                    <p className="font-medium text-slate-300">
                      No hay suscripciones en riesgo ni vencidas en este momento
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Todos los suscriptores se encuentran al día con sus renovaciones
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Broadcast Banner Quick Manager */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-cyan-400 flex items-center justify-center">
                  <Megaphone size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Anuncio Global</h2>
                  <p className="text-xs text-slate-400">Publicar banner visible para todos los tenants</p>
                </div>
              </div>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Estado del Anuncio
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="activo"
                      checked={broadcastForm.activo === true}
                      onChange={() => setBroadcastForm({ ...broadcastForm, activo: true })}
                      className="accent-indigo-500 w-4 h-4"
                    />
                    <span className="text-sm font-medium text-emerald-400">Activo (Visible)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="activo"
                      checked={broadcastForm.activo === false}
                      onChange={() => setBroadcastForm({ ...broadcastForm, activo: false })}
                      className="accent-indigo-500 w-4 h-4"
                    />
                    <span className="text-sm font-medium text-slate-400">Inactivo (Oculto)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Tipo de Notificación
                </label>
                <select
                  value={broadcastForm.tipo}
                  onChange={(e) =>
                    setBroadcastForm({
                      ...broadcastForm,
                      tipo: e.target.value as 'info' | 'warning' | 'critical',
                    })
                  }
                  className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-sm text-slate-100"
                >
                  <option value="info">🔵 Informativo (Info)</option>
                  <option value="warning">🟡 Advertencia / Mantenimiento (Warning)</option>
                  <option value="critical">🔴 Crítico / Alerta urgente (Critical)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Mensaje del Banner
                </label>
                <textarea
                  rows={3}
                  value={broadcastForm.mensaje}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, mensaje: e.target.value })}
                  placeholder="Ej: Mantenimiento programado hoy a las 23:00 UTC. La plataforma continuará operativa..."
                  className="w-full p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleClearBroadcast}
                  disabled={savingBroadcast}
                  className="px-4 py-2.5 rounded-xl bg-rose-950/50 hover:bg-rose-900 border border-rose-800/40 text-rose-300 text-sm font-medium transition-colors"
                >
                  Desactivar
                </button>
                <div className="flex-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBroadcastModal(false)}
                    className="flex-1 btn-secondary text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingBroadcast}
                    className="flex-1 btn-primary text-sm shadow-lg shadow-indigo-950/50"
                  >
                    {savingBroadcast ? 'Guardando...' : 'Publicar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
