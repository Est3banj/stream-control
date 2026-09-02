import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import usePermisos from '../hooks/usePermisos';
import useVentas from '../hooks/useVentas';
import useClientes from '../hooks/useClientes';
import useCuentas from '../hooks/useCuentas';
import { useMoneda } from '../hooks/useMoneda';
import LoadingScreen from '../components/LoadingScreen';
import {
  DollarSign,
  TrendingUp,
  Users,
  Tv,
  AlertCircle,
  Calendar,
  ArrowUpRight,
  MessageCircle,
  Clock,
  Sparkles,
  PlusCircle,
  Key,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Flame,
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
} from 'recharts';
import PlataformaBadge from '../components/PlataformaBadge';
import AdminDashboard from './AdminDashboard';
import { parseDate } from '../utils/dateUtils';
import type { Venta } from '../types/venta';
import type { Cliente } from '../types/cliente';

const DONUT_COLORS = ['#6366f1', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

/**
 * Genera el enlace directo a WhatsApp con mensaje de cortesía preformateado
 */
export function buildWhatsAppUrl(telefono: string, mensaje: string): string {
  const tel = (telefono || '').trim();
  if (!tel || tel.startsWith('@')) return '#';
  const numLimpio = tel.replace(/[^0-9+]/g, '');
  const numParaUrl = numLimpio.startsWith('+')
    ? numLimpio.replace(/[^0-9]/g, '')
    : (numLimpio.length === 10 ? `57${numLimpio}` : numLimpio.replace(/[^0-9]/g, ''));
  return `https://wa.me/${numParaUrl}?text=${encodeURIComponent(mensaje)}`;
}

export default function Dashboard() {
  const { user } = useAuth();

  // Admin redirect
  if (user?.rol === 'admin') {
    return <AdminDashboard />;
  }

  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _permisos = usePermisos(user);
  const { ventas, loading: loadingVentas, error: errorVentas } = useVentas(user);
  const { clientes, loading: loadingClientes, error: errorClientes } = useClientes(user);
  const { cuentas, loading: loadingCuentas, error: errorCuentas } = useCuentas(user);
  const { formatear, convertirVenta, simbolo } = useMoneda();

  // Action Center cohort filter
  const [cohortFilter, setCohortFilter] = useState<'todos' | 'urgentes' | 'vencidos'>('todos');

  const loading = loadingVentas || loadingClientes || loadingCuentas;
  const error = errorVentas || errorClientes || errorCuentas;

  // Fecha actual y MTD
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentMonthName = useMemo(() => {
    const raw = now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [now]);

  // 1. MTD & Métricas Financieras
  const {
    ventasMes,
    ingresosMes,
    costosMes,
    utilidadMes,
    margenMes,
    totalIngresosHistorico,
    totalUtilidadHistorica,
  } = useMemo(() => {
    let ingMes = 0;
    let costMes = 0;
    let utMes = 0;
    let totIngHist = 0;
    let totUtHist = 0;
    const vMes: Venta[] = [];

    ventas.forEach((v) => {
      const parsed = parseDate(v.fechaVenta || v.fechaInicio || v.fechaRegistro);
      const precioTotal = (v.precioVenta * (v.pantallas || 1)) || v.precioVenta || 0;
      const ingreso = convertirVenta(precioTotal, v.monedaVenta, v.tasaVenta);
      const costo = convertirVenta(Number(v.costoServicio) || 0, v.monedaVenta, v.tasaVenta);
      const utilidad = v.utilidad !== undefined
        ? convertirVenta(Number(v.utilidad) || 0, v.monedaVenta, v.tasaVenta)
        : (ingreso - costo);

      totIngHist += ingreso;
      totUtHist += utilidad;

      if (parsed && parsed.getFullYear() === currentYear && parsed.getMonth() === currentMonth) {
        vMes.push(v);
        ingMes += ingreso;
        costMes += costo;
        utMes += utilidad;
      }
    });

    const margen = ingMes > 0 ? (utMes / ingMes) * 100 : 0;

    return {
      ventasMes: vMes,
      ingresosMes: ingMes,
      costosMes: costMes,
      utilidadMes: utMes,
      margenMes: margen,
      totalIngresosHistorico: totIngHist,
      totalUtilidadHistorica: totUtHist,
    };
  }, [ventas, currentYear, currentMonth, convertirVenta]);

  // 2. Clientes Metrics
  const {
    clientesActivos,
    clientesEnMora,
    vencimientosCriticos,
    totalSaldoPendiente,
  } = useMemo(() => {
    const activos: Cliente[] = [];
    const mora: Cliente[] = [];
    const criticos: Cliente[] = [];
    let saldoPend = 0;

    clientes.forEach((c) => {
      const dias = c.diasRestantes ?? 0;
      const saldo = Number(c.saldoPendiente) || 0;
      saldoPend += saldo;

      if (dias > 0) {
        activos.push(c);
      }
      if (saldo > 0 || dias <= 0) {
        mora.push(c);
      }
      if (dias >= 0 && dias <= 3) {
        criticos.push(c);
      }
    });

    return {
      clientesActivos: activos,
      clientesEnMora: mora,
      vencimientosCriticos: criticos,
      totalSaldoPendiente: saldoPend,
    };
  }, [clientes]);

  // 3. Inventario & Capacidad
  const {
    totalCuentas,
    totalPerfiles,
    perfilesAsignados,
    perfilesDisponibles,
    porcentajeOcupacion,
    stockPorPlataforma,
  } = useMemo(() => {
    const tCuentas = cuentas.length;
    let tPerfiles = 0;
    let pAsignados = 0;
    const provMap: Record<string, { proveedor: string; total: number; asignados: number; disponibles: number }> = {};

    cuentas.forEach((c) => {
      const perfiles = Array.isArray(c.perfiles) ? c.perfiles : [];
      const count = perfiles.length > 0 ? perfiles.length : ((c as any).maxPerfiles || 1);
      const asig = perfiles.filter((p) => p.estado === 'asignado').length;

      tPerfiles += count;
      pAsignados += asig;

      const prov = (c.proveedor || c.nombreProveedor || 'Otros').trim();
      if (!provMap[prov]) {
        provMap[prov] = { proveedor: prov, total: 0, asignados: 0, disponibles: 0 };
      }
      provMap[prov].total += count;
      provMap[prov].asignados += asig;
      provMap[prov].disponibles += Math.max(0, count - asig);
    });

    const pDisp = Math.max(0, tPerfiles - pAsignados);
    const ocupacion = tPerfiles > 0 ? Math.round((pAsignados / tPerfiles) * 100) : 0;
    const sortedStock = Object.values(provMap).sort((a, b) => b.total - a.total);

    return {
      totalCuentas: tCuentas,
      totalPerfiles: tPerfiles,
      perfilesAsignados: pAsignados,
      perfilesDisponibles: pDisp,
      porcentajeOcupacion: ocupacion,
      stockPorPlataforma: sortedStock,
    };
  }, [cuentas]);

  // 4. Action Center Cohorts
  const clientesActionCenter = useMemo(() => {
    return clientes
      .filter((c) => {
        const dias = c.diasRestantes ?? 0;
        const saldo = Number(c.saldoPendiente) || 0;
        if (cohortFilter === 'todos') {
          return dias <= 7 || saldo > 0;
        }
        if (cohortFilter === 'urgentes') {
          return dias >= 0 && dias <= 3;
        }
        if (cohortFilter === 'vencidos') {
          return dias <= 0 || saldo > 0;
        }
        return true;
      })
      .sort((a, b) => (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0));
  }, [clientes, cohortFilter]);

  // 5. 6-Month Timeline for AreaChart
  const timelineData = useMemo(() => {
    const months: { mesKey: string; mes: string; ingresos: number; utilidad: number }[] = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const mesKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
      const mesLabel = targetDate.toLocaleDateString('es-CO', { month: 'short' });
      const capitalLabel = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1).replace('.', '');
      months.push({
        mesKey,
        mes: capitalLabel,
        ingresos: 0,
        utilidad: 0,
      });
    }

    ventas.forEach((v) => {
      const parsed = parseDate(v.fechaVenta || v.fechaInicio || v.fechaRegistro);
      if (!parsed) return;
      const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
      const item = months.find((m) => m.mesKey === key);
      if (item) {
        const precioTotal = (v.precioVenta * (v.pantallas || 1)) || v.precioVenta || 0;
        const ing = convertirVenta(precioTotal, v.monedaVenta, v.tasaVenta);
        const costo = convertirVenta(Number(v.costoServicio) || 0, v.monedaVenta, v.tasaVenta);
        const ut = v.utilidad !== undefined
          ? convertirVenta(Number(v.utilidad) || 0, v.monedaVenta, v.tasaVenta)
          : (ing - costo);

        item.ingresos += ing;
        item.utilidad += ut;
      }
    });

    return months;
  }, [ventas, convertirVenta]);

  // 6. Platform Donut Chart
  const platformDonutData = useMemo(() => {
    const map: Record<string, { name: string; value: number; ingresos: number }> = {};
    ventas.forEach((v) => {
      const plat = (v.plataforma || 'Otros').trim();
      if (!map[plat]) {
        map[plat] = { name: plat, value: 0, ingresos: 0 };
      }
      const pantallas = v.pantallas || 1;
      const precioTotal = (v.precioVenta * pantallas) || v.precioVenta || 0;
      const ing = convertirVenta(precioTotal, v.monedaVenta, v.tasaVenta);
      map[plat].value += pantallas;
      map[plat].ingresos += ing;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [ventas, convertirVenta]);

  // 7. Top 5 Clientes VIP
  const topClientesVIP = useMemo(() => {
    const map: Record<string, { nombre: string; telefono: string; totalGastado: number; totalVentas: number; plataformas: Set<string> }> = {};
    ventas.forEach((v) => {
      const name = v.nombre?.trim() || 'Cliente';
      if (!map[name]) {
        const clientObj = clientes.find((c) => c.nombre?.trim().toLowerCase() === name.toLowerCase());
        map[name] = {
          nombre: name,
          telefono: v.telefono || clientObj?.telefono || '',
          totalGastado: 0,
          totalVentas: 0,
          plataformas: new Set(),
        };
      }
      const precioTotal = (v.precioVenta * (v.pantallas || 1)) || v.precioVenta || 0;
      const ing = convertirVenta(precioTotal, v.monedaVenta, v.tasaVenta);
      map[name].totalGastado += ing;
      map[name].totalVentas += 1;
      if (v.plataforma) map[name].plataformas.add(v.plataforma);
    });

    return Object.values(map)
      .sort((a, b) => b.totalGastado - a.totalGastado)
      .slice(0, 5)
      .map((c) => ({
        ...c,
        plataformas: Array.from(c.plataformas),
      }));
  }, [ventas, clientes, convertirVenta]);

  // 8. Top Plataformas más rentables
  const topPlataformasRentables = useMemo(() => {
    const map: Record<string, { plataforma: string; ventasCount: number; pantallasCount: number; ingresos: number; utilidad: number }> = {};
    ventas.forEach((v) => {
      const plat = (v.plataforma || 'General').trim();
      if (!map[plat]) {
        map[plat] = { plataforma: plat, ventasCount: 0, pantallasCount: 0, ingresos: 0, utilidad: 0 };
      }
      const pantallas = v.pantallas || 1;
      const precioTotal = (v.precioVenta * pantallas) || v.precioVenta || 0;
      const ing = convertirVenta(precioTotal, v.monedaVenta, v.tasaVenta);
      const costo = convertirVenta(Number(v.costoServicio) || 0, v.monedaVenta, v.tasaVenta);
      const ut = v.utilidad !== undefined
        ? convertirVenta(Number(v.utilidad) || 0, v.monedaVenta, v.tasaVenta)
        : (ing - costo);

      map[plat].ventasCount += 1;
      map[plat].pantallasCount += pantallas;
      map[plat].ingresos += ing;
      map[plat].utilidad += ut;
    });

    return Object.values(map)
      .map((item) => ({
        ...item,
        margen: item.ingresos > 0 ? Math.round((item.utilidad / item.ingresos) * 100) : 0,
      }))
      .sort((a, b) => b.utilidad - a.utilidad)
      .slice(0, 5);
  }, [ventas, convertirVenta]);

  const getMensajeWhatsApp = (c: Cliente) => {
    const dias = c.diasRestantes ?? 0;
    const plat = c.plataforma || 'streaming';
    if (dias > 0) {
      return `Hola ${c.nombre}, te recordamos que tu servicio de ${plat} vence en ${dias} día${dias > 1 ? 's' : ''}. Para renovar tu cuenta y seguir disfrutando sin interrupciones, estamos atentos a tu respuesta. ¡Muchas gracias!`;
    } else if (dias === 0) {
      return `Hola ${c.nombre}, tu servicio de ${plat} vence el día de hoy. Te invitamos a realizar tu renovación para mantener tu perfil activo y sin cortes.`;
    } else {
      return `Hola ${c.nombre}, tu servicio de ${plat} finalizó hace ${Math.abs(dias)} día${Math.abs(dias) > 1 ? 's' : ''}. Si deseas reactivar tu cuenta y continuar con tu contenido favorito, avísanos con gusto.`;
    }
  };

  if (loading) {
    return <LoadingScreen mensaje="Cargando panel operativo..." />;
  }

  return (
    <div className="space-y-7 animate-fade-in text-slate-100 pb-12">
      {/* Error Alert */}
      {error && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-2xl p-4 flex items-center gap-3 text-rose-300 shadow-xl backdrop-blur-md">
          <AlertCircle className="text-rose-400 shrink-0" size={20} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Header Dark SaaS Elite */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-500/10 via-cyan-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Panel Operativo <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-cyan-400 to-teal-300">Dashboard</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-950/80 text-cyan-300 border border-indigo-700/50 shadow-inner">
              <Calendar size={13} className="text-indigo-400" />
              {currentMonthName}
            </span>
          </div>
          <p className="text-slate-400 text-sm sm:text-base font-normal">
            Resumen de tus ventas y métricas principales
          </p>
        </div>

        {/* 4 Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 z-10 p-1.5 bg-slate-950/60 border border-slate-800/80 rounded-2xl backdrop-blur-md shadow-inner">
          <button
            onClick={() => navigate('/ventas')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-950/80 hover:shadow-indigo-500/25 border border-indigo-400/40 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
          >
            <PlusCircle size={16} className="text-cyan-200" />
            <span>Nueva Venta</span>
          </button>

          <button
            onClick={() => navigate('/cuentas')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-cyan-300 text-xs sm:text-sm font-semibold border border-slate-700/80 hover:border-cyan-500/50 shadow-md shadow-black/30 hover:shadow-cyan-950/40 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group"
          >
            <Tv size={16} className="text-cyan-400 group-hover:scale-110 transition-transform" />
            <span>Cargar Cuenta</span>
          </button>

          <button
            onClick={() => navigate('/gestion-clientes')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-emerald-300 text-xs sm:text-sm font-semibold border border-slate-700/80 hover:border-emerald-500/50 shadow-md shadow-black/30 hover:shadow-emerald-950/40 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group"
          >
            <Users size={16} className="text-emerald-400 group-hover:scale-110 transition-transform" />
            <span>Directorio Clientes</span>
          </button>

          <button
            onClick={() => navigate('/consulta-codigos')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-amber-300 text-xs sm:text-sm font-semibold border border-slate-700/80 hover:border-amber-500/50 shadow-md shadow-black/30 hover:shadow-amber-950/40 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group"
          >
            <Key size={16} className="text-amber-400 group-hover:scale-110 transition-transform" />
            <span>Códigos de Acceso</span>
          </button>
        </div>
      </div>

      {/* 5 KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5">
        {/* KPI 1: Facturación MTD */}
        <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-indigo-500/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/20 transition-all" />
          <div className="flex items-center justify-between mb-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-950/40">
              <DollarSign size={22} />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-800/50">
              {ventasMes.length} ventas mes
            </span>
          </div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Ingresos
          </p>
          <p className="text-2xl font-black text-white mt-1 tracking-tight">
            {formatear(ingresosMes)}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
            <span className="text-indigo-400 font-semibold">Histórico:</span>
            <span>{formatear(totalIngresosHistorico)}</span>
          </div>
        </div>

        {/* KPI 2: Utilidad Neta MTD */}
        <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />
          <div className="flex items-center justify-between mb-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/40">
              <TrendingUp size={22} />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
              {margenMes.toFixed(1)}% Margen
            </span>
          </div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Utilidad
          </p>
          <p className={`text-2xl font-black mt-1 tracking-tight ${utilidadMes >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatear(utilidadMes)}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
            <span className="text-emerald-400 font-semibold">Egresos mes:</span>
            <span>{formatear(costosMes)}</span>
          </div>
        </div>

        {/* KPI 3: Clientes Activos */}
        <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-cyan-500/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/20 transition-all" />
          <div className="flex items-center justify-between mb-3.5">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-950/40">
              <Users size={22} />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950/60 text-cyan-300 border border-cyan-800/50">
              {clientes.length} Totales
            </span>
          </div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Clientes Activos
          </p>
          <p className="text-2xl font-black text-white mt-1 tracking-tight">
            {clientesActivos.length}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
            <span className="text-cyan-400 font-semibold">{clientesEnMora.length}</span>
            <span>en mora o vencidos</span>
          </div>
        </div>

        {/* KPI 4: Capacidad & Perfiles */}
        <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-purple-500/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-500/20 transition-all" />
          <div className="flex items-center justify-between mb-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shadow-lg shadow-purple-950/40">
              <Tv size={22} />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-950/60 text-purple-300 border border-purple-800/50">
              {porcentajeOcupacion}% Ocupado
            </span>
          </div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Stock Disponible
          </p>
          <p className="text-2xl font-black text-white mt-1 tracking-tight">
            {perfilesDisponibles}{' '}
            <span className="text-sm font-medium text-slate-400">perfiles</span>
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
            <span className="text-purple-400 font-semibold">{perfilesAsignados}</span>
            <span>de {totalPerfiles} asignados ({totalCuentas} ctas)</span>
          </div>
        </div>

        {/* KPI 5: Cartera / Vencimientos */}
        <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/20 transition-all" />
          <div className="flex items-center justify-between mb-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-950/40">
              <AlertCircle size={22} />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/50">
              {vencimientosCriticos.length} por vencer (≤3d)
            </span>
          </div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Cartera Pendiente
          </p>
          <p className="text-2xl font-black text-white mt-1 tracking-tight">
            {formatear(totalSaldoPendiente)}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
            <span className="text-amber-400 font-semibold">{clientesEnMora.length}</span>
            <span>cobros por gestionar</span>
          </div>
        </div>
      </div>

      {/* Capacity Progress & Platform Stock Chips */}
      <div className="bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="text-indigo-400" size={18} />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Capacidad e Inventario en Tiempo Real
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {perfilesAsignados} de {totalPerfiles} perfiles asignados ({porcentajeOcupacion}% utilizado)
          </span>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full bg-slate-800/80 h-3 rounded-full overflow-hidden border border-slate-700/50 p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, porcentajeOcupacion))}%` }}
          />
        </div>

        {/* Platform Stock Chips */}
        {stockPorPlataforma.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {stockPorPlataforma.map((item) => (
              <div
                key={item.proveedor}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs shadow-sm hover:border-slate-700 transition-colors"
              >
                <PlataformaBadge plataforma={item.proveedor} size="sm" />
                <span className="text-slate-400 font-mono text-[11px]">
                  <strong className="text-emerald-400">{item.disponibles}</strong> disp / {item.total} tot
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No hay cuentas ni perfiles cargados en el inventario.</p>
        )}
      </div>

      {/* Gráficos Recharts Dark Theme */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico 1: Timeline de 6 meses */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                <TrendingUp size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Evolución Semestral de Ventas</h2>
                <p className="text-xs text-slate-400">Ingresos brutos vs Utilidad neta (Últimos 6 meses)</p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-950/80 border border-slate-800 text-slate-400">
              Moneda: {simbolo}
            </span>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIngresosRetail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorUtilidadRetail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey="mes" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
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
                    formatear(Number(val) || 0),
                    name === 'ingresos' ? 'Ingresos' : 'Utilidad Neta',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="ingresos"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorIngresosRetail)"
                />
                <Area
                  type="monotone"
                  dataKey="utilidad"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorUtilidadRetail)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Distribución por Plataforma */}
        <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                <Tv size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Ventas por Plataforma</h2>
                <p className="text-xs text-slate-400">Distribución de pantallas y accesos vendidos</p>
              </div>
            </div>

            <div className="h-[210px] w-full mt-2">
              {platformDonutData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={platformDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {platformDonutData.map((_, index) => (
                        <Cell
                          key={`cell-plat-${index}`}
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
                      formatter={(val: any) => [`${val} pantallas`, 'Volumen']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                  Sin ventas registradas
                </div>
              )}
            </div>
          </div>

          {/* Legend Pills */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800">
            {platformDonutData.slice(0, 5).map((plat, i) => (
              <div
                key={plat.name}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                />
                <span className="font-medium">{plat.name}:</span>
                <span className="font-bold text-white">{plat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Center Cohorts: Cobranza & Vencimientos */}
      <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-950/40">
              <Clock size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Action Center: Cobranza & Renovaciones</h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Contactá a clientes con servicios por vencer o en mora vía WhatsApp en 1-clic
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setCohortFilter('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                cohortFilter === 'todos'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos (≤7d)
            </button>
            <button
              onClick={() => setCohortFilter('urgentes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                cohortFilter === 'urgentes'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Urgentes (≤3d)
            </button>
            <button
              onClick={() => setCohortFilter('vencidos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                cohortFilter === 'vencidos'
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
              <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-xs font-semibold">
                <th className="px-6 py-4">Cliente</th>
                <th className="px-4 py-4">Servicio</th>
                <th className="px-4 py-4">Vencimiento</th>
                <th className="px-4 py-4 text-right">Saldo Pendiente</th>
                <th className="px-6 py-4 text-center">Acción Inmediata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {clientesActionCenter.length > 0 ? (
                clientesActionCenter.map((cliente) => {
                  const dias = cliente.diasRestantes ?? 0;
                  const saldo = Number(cliente.saldoPendiente) || 0;
                  const mensajeWA = getMensajeWhatsApp(cliente);
                  const waUrl = buildWhatsAppUrl(cliente.telefono, mensajeWA);
                  const esNumeroValido = Boolean(cliente.telefono && !cliente.telefono.startsWith('@'));

                  return (
                    <tr
                      key={cliente.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{cliente.nombre}</div>
                        <div className="text-xs text-slate-400 font-mono">
                          {cliente.telefono || 'Sin teléfono'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <PlataformaBadge plataforma={cliente.plataforma || 'General'} size="sm" />
                      </td>
                      <td className="px-4 py-4">
                        {dias < 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-950/60 text-rose-400 border border-rose-800/50">
                            <AlertTriangle size={12} />
                            Vencido hace {Math.abs(dias)}d
                          </span>
                        ) : dias === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-950/60 text-rose-400 border border-rose-800/50">
                            <Flame size={12} />
                            Vence Hoy
                          </span>
                        ) : dias <= 3 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/60 text-amber-300 border border-amber-800/50">
                            <Clock size={12} />
                            Vence en {dias}d
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            Vence en {dias}d
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {saldo > 0 ? (
                          <span className="font-bold text-rose-400 font-mono">
                            {formatear(saldo)}
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-400 font-medium">Al día</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {esNumeroValido ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 transition-all hover:scale-105 active:scale-95"
                            title="Contactar vía WhatsApp"
                          >
                            <MessageCircle size={14} />
                            <span>Cobrar WhatsApp</span>
                          </a>
                        ) : (
                          <button
                            disabled
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-500 text-xs font-medium cursor-not-allowed border border-slate-700/50"
                          >
                            <MessageCircle size={14} />
                            <span>Sin WhatsApp</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">
                    <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-500/40" />
                    <p className="font-medium text-slate-300">
                      No hay clientes con vencimientos o cobranzas pendientes en este cohorte
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Todos los clientes se encuentran al día con sus renovaciones
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leaderboards: Top Clientes VIP & Plataformas Rentables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Clientes VIP */}
        <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Top 5 Clientes VIP</h3>
                <p className="text-xs text-slate-400">Clientes con mayor volumen histórico de compras</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/gestion-clientes')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
            >
              <span>Ver todos</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="divide-y divide-slate-800/60">
            {topClientesVIP.length > 0 ? (
              topClientesVIP.map((cliente, idx) => {
                const waUrl = buildWhatsAppUrl(cliente.telefono, `Hola ${cliente.nombre}, como cliente VIP queremos ofrecerte promociones especiales en tus renovaciones.`);
                return (
                  <div
                    key={cliente.nombre}
                    className="py-3.5 flex items-center justify-between gap-3 hover:bg-slate-800/20 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white text-sm truncate">{cliente.nombre}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="text-xs text-slate-400 font-mono">{cliente.totalVentas} compras</span>
                          {cliente.plataformas.slice(0, 2).map((p) => (
                            <PlataformaBadge key={p} plataforma={p} size="sm" />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="font-bold text-emerald-400 text-sm">
                        {formatear(cliente.totalGastado)}
                      </span>
                      {cliente.telefono && !cliente.telefono.startsWith('@') && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 transition-all"
                          title="Contactar VIP"
                        >
                          <MessageCircle size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center py-8 text-slate-500 text-sm">No hay ventas registradas</p>
            )}
          </div>
        </div>

        {/* Top Plataformas más rentables */}
        <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <DollarSign size={18} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Plataformas Más Rentables</h3>
                <p className="text-xs text-slate-400">Margen y utilidad acumulada por proveedor</p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-800/60">
            {topPlataformasRentables.length > 0 ? (
              topPlataformasRentables.map((plat) => (
                <div
                  key={plat.plataforma}
                  className="py-3.5 flex items-center justify-between gap-3 hover:bg-slate-800/20 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <PlataformaBadge plataforma={plat.plataforma} size="md" />
                    <span className="text-xs text-slate-400 font-mono">
                      {plat.pantallasCount} pantallas
                    </span>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-emerald-400 text-sm">
                      +{formatear(plat.utilidad)}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Margen {plat.margen}% ({formatear(plat.ingresos)})
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-8 text-slate-500 text-sm">No hay datos de rentabilidad</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

