import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useVentas from '../hooks/useVentas';
import useClientes from '../hooks/useClientes';
import useSuscripciones from '../hooks/useSuscripciones';
import usePermisos from '../hooks/usePermisos';
import { useMoneda } from '../hooks/useMoneda';
import FeatureBlocked from '../components/FeatureBlocked';
import { DollarSign, TrendingUp, TrendingDown, Users, Tv, ShoppingCart, AlertCircle, CreditCard } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Venta } from '../types/venta';

const COLORS = ['#6366F1', '#38BDF8', '#A855F7', '#34D399', '#F43F5E'];

export default function Dashboard() {
  const { user } = useAuth();
  const permisos = usePermisos(user);
  const isAdmin = user?.rol === 'admin';
  const { ventas, loading, error } = useVentas(user);
  const { clientes } = useClientes(user);
  const { suscripciones } = useSuscripciones(user);
  const { formatear, convertirVenta } = useMoneda();

  const [usuariosCount, setUsuariosCount] = useState(0);

  const [totales, setTotales] = useState<{ ingresos: number; egresos: number; utilidad: number }>({ ingresos: 0, egresos: 0, utilidad: 0 });
  const [topClientes, setTopClientes] = useState<Array<{ nombre: string; ventas: number }>>([]);
  const [topVendedores, setTopVendedores] = useState<Array<{ email: string; ventas: number }>>([]);
  const [topPlataformas, setTopPlataformas] = useState<Array<{ plataforma: string; pantallas: number }>>([]);

  // One-time fetch for usuarios count (admin only)
  useEffect(() => {
    if (!isAdmin) return;
    let mounted = true;
    getDocs(collection(db, 'usuarios')).then((snapshot) => {
      if (mounted) setUsuariosCount(snapshot.size);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [isAdmin]);

  // Admin KPIs — solo desde suscripciones, NO desde ventas
  const activeSuscripciones = useMemo(
    () => suscripciones.filter((s) => s.estado === 'activa').length,
    [suscripciones]
  );

  const totalIngresos = useMemo(
    () => suscripciones
      .filter((s) => s.pagoEstado === 'pagado')
      .reduce((sum, s) => sum + (s.monto || 0), 0),
    [suscripciones]
  );

  const ingresosEsteMes = useMemo(() => {
    const prefix = new Date().toISOString().slice(0, 7);
    return suscripciones
      .filter((s) => {
        if (s.pagoEstado !== 'pagado') return false;
        if (!s.fechaInicio?.seconds) return false;
        return new Date(s.fechaInicio.seconds * 1000).toISOString().startsWith(prefix);
      })
      .reduce((sum, s) => sum + (s.monto || 0), 0);
  }, [suscripciones]);

  // Procesar ventas cuando cambian
  useEffect(() => {
    if (loading || !ventas.length) return;

    let ingresos = 0, costos = 0, utilidad = 0;
    const clientes: Record<string, number> = {};
    const plataformas: Record<string, number> = {};
    const vendedores: Record<string, number> = {};

    ventas.forEach((v: Venta) => {
      const ingresoVenta = convertirVenta((v.precioVenta * v.pantallas) || 0, v.monedaVenta, v.tasaVenta);
      ingresos += ingresoVenta;
      costos += convertirVenta(Number(v.costoServicio) || 0, v.monedaVenta, v.tasaVenta);
      utilidad += convertirVenta(Number(v.utilidad) || 0, v.monedaVenta, v.tasaVenta);

      if (v.nombre) {
        clientes[v.nombre] = (clientes[v.nombre] || 0) + ingresoVenta;
      }
      if (v.plataforma) {
        plataformas[v.plataforma] = (plataformas[v.plataforma] || 0) + (v.pantallas || 0);
      }
      if (v.usuarioEmail) {
        vendedores[v.usuarioEmail] = (vendedores[v.usuarioEmail] || 0) + ingresoVenta;
      }
    });

    setTotales({ ingresos, egresos: costos, utilidad });

    const topClientesSorted = Object.entries(clientes)
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, ventas]) => ({ nombre, ventas }));
    setTopClientes(topClientesSorted);

    const topPlataformasSorted = Object.entries(plataformas)
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
      .slice(0, 5)
      .map(([plataforma, pantallas]) => ({ plataforma, pantallas }));
    setTopPlataformas(topPlataformasSorted);

    const topVendedoresSorted = Object.entries(vendedores)
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
      .slice(0, 5)
      .map(([email, ventas]) => ({ email, ventas }));
    setTopVendedores(topVendedoresSorted);
  }, [ventas, loading]);

  // Datos para gráfico de barras de clientes
  const clientesChartData = useMemo(() => {
    return topClientes.map((item) => ({
      name: item.nombre.length > 15 ? item.nombre.substring(0, 15) + '...' : item.nombre,
      ventas: item.ventas,
      fullName: item.nombre,
    }));
  }, [topClientes]);

  const vendedoresChartData = useMemo(() => {
    return topVendedores.map((item) => ({
      name: item.email.length > 15 ? item.email.substring(0, 15) + '...' : item.email,
      ventas: item.ventas,
      fullName: item.email,
    }));
  }, [topVendedores]);

  const barChartTitle = isAdmin ? 'Top 5 Vendedores' : 'Top 5 Clientes por Ventas';
  const barChartData = isAdmin ? vendedoresChartData : clientesChartData;

  // Datos para gráfico de pie de plataformas
  const plataformasChartData = useMemo(() => {
    return topPlataformas.map((item) => ({
      name: item.plataforma,
      value: item.pantallas,
    }));
  }, [topPlataformas]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
          <p className="text-slate-400 font-medium">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (!permisos.puedeVerDashboardEjecutivo) {
    return (
      <div className="space-y-6 animate-fade-in text-slate-100">
        <div className="mb-6">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
            Dashboard
          </h1>
          <p className="text-slate-400">Panel ejecutivo con métricas y reportes</p>
        </div>
        <FeatureBlocked
          feature="Dashboard Ejecutivo"
          description="Accedé a métricas avanzadas, indicadores y gráficos de tu negocio."
          plan="Enterprise"
        />
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
      {/* Título */}
      <div className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
          {isAdmin ? 'Panel de Administración' : 'Dashboard'}
        </h1>
        <p className="text-slate-400">
          {isAdmin ? 'Métricas globales de la plataforma' : 'Resumen de tus ventas y métricas principales'}
        </p>
      </div>

      {/* Cards de métricas */}
      {isAdmin ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Usuarios Registrados */}
          <div className="card cursor-default">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-950/50">
                <Users className="text-white" size={28} />
              </div>
              <Users className="text-indigo-400" size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">Usuarios Registrados</p>
              <p className="text-3xl font-bold text-white">{usuariosCount.toLocaleString()}</p>
            </div>
          </div>

          {/* Suscripciones Activas */}
          <div className="card cursor-default">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-950/50">
                <CreditCard className="text-white" size={28} />
              </div>
              <CreditCard className="text-amber-400" size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">Suscripciones Activas</p>
              <p className="text-3xl font-bold text-white">{activeSuscripciones.toLocaleString()}</p>
            </div>
          </div>

          {/* Ingresos Totales */}
          <div className="card cursor-default">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-950/50">
                <DollarSign className="text-white" size={28} />
              </div>
              <DollarSign className="text-indigo-400" size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">Ingresos Totales</p>
              <p className="text-3xl font-bold text-white">{formatear(totalIngresos)}</p>
            </div>
          </div>

          {/* Ingresos Este Mes */}
          <div className="card cursor-default">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-950/50">
                <TrendingUp className="text-white" size={28} />
              </div>
              <TrendingUp className="text-emerald-400" size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">Ingresos Este Mes</p>
              <p className="text-3xl font-bold text-white">{formatear(ingresosEsteMes)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Ingresos */}
          <div className="card cursor-default">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-950/50">
                <DollarSign className="text-white" size={28} />
              </div>
              <TrendingUp className="text-emerald-400" size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">Ingresos</p>
              <p className="text-3xl font-bold text-white">{formatear(totales.ingresos)}</p>
            </div>
          </div>

          {/* Egresos */}
          <div className="card cursor-default">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-950/50">
                <DollarSign className="text-white" size={28} />
              </div>
              <TrendingDown className="text-rose-400" size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">Egresos</p>
              <p className="text-3xl font-bold text-white">{formatear(totales.egresos)}</p>
            </div>
          </div>

          {/* Utilidad */}
          <div className="card cursor-default">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-950/50">
                <TrendingUp className="text-white" size={28} />
              </div>
              <div className={`text-2xl font-bold ${totales.utilidad >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totales.utilidad >= 0 ? '\u2191' : '\u2193'}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">Utilidad</p>
              <p className={`text-3xl font-bold ${totales.utilidad >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatear(totales.utilidad)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Gráficos — solo para usuarios regulares */}
      {!isAdmin && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            {/* Gráfico de barras - Top Clientes */}
            <div className="card">
              <div className="flex items-center gap-2 mb-6">
                <Users className="text-indigo-400" size={24} />
                <h2 className="text-xl font-bold text-white">{barChartTitle}</h2>
              </div>
              {barChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#475569" />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#475569" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        color: '#f8fafc',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                      }}
                      itemStyle={{ color: '#818cf8', fontWeight: 600 }}
                      labelStyle={{ color: '#e2e8f0', fontWeight: 700, marginBottom: '0.25rem' }}
                      formatter={(value: any) => [formatear(value), 'Ventas']}
                      labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.fullName || label}
                    />
                    <Bar dataKey="ventas" fill="#6366f1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-slate-500">
                  <p>No hay datos disponibles</p>
                </div>
              )}
            </div>

            {/* Gráfico de pie - Top Plataformas */}
            <div className="card">
              <div className="flex items-center gap-2 mb-6">
                <Tv className="text-indigo-400" size={24} />
                <h2 className="text-xl font-bold text-white">Top 5 Plataformas</h2>
              </div>
              {plataformasChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={plataformasChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {plataformasChartData.map((entry: { name: string; value: number }, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                      itemStyle={{ color: '#818cf8', fontWeight: 600 }}
                      formatter={(value: any) => [`${value} pantallas`, 'Cantidad']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-slate-500">
                  <p>No hay datos disponibles</p>
                </div>
              )}
            </div>
          </div>

          {/* Tablas de resumen */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Tabla de clientes */}
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <Users className="text-indigo-400" size={20} />
                <h3 className="text-lg font-semibold text-white">Clientes Destacados</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 uppercase tracking-wider text-xs">
                      <th className="px-4 py-3 text-left font-semibold rounded-tl-xl">Cliente</th>
                      <th className="px-4 py-3 text-right font-semibold rounded-tr-xl">Ventas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topClientes.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="text-center py-8 text-slate-500">No hay datos</td>
                      </tr>
                    ) : (
                      topClientes.map((cliente) => (
                        <tr
                          key={cliente.nombre}
                          className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-slate-200">{cliente.nombre}</td>
                          <td className="px-4 py-3 text-right font-semibold text-indigo-400">
                            {formatear(cliente.ventas)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabla de plataformas */}
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <Tv className="text-indigo-400" size={20} />
                <h3 className="text-lg font-semibold text-white">Plataformas Populares</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 uppercase tracking-wider text-xs">
                      <th className="px-4 py-3 text-left font-semibold rounded-tl-xl">Plataforma</th>
                      <th className="px-4 py-3 text-right font-semibold rounded-tr-xl">Pantallas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPlataformas.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="text-center py-8 text-slate-500">No hay datos</td>
                      </tr>
                    ) : (
                      topPlataformas.map((plataforma) => (
                        <tr
                          key={plataforma.plataforma}
                          className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-slate-200">{plataforma.plataforma}</td>
                          <td className="px-4 py-3 text-right font-semibold text-cyan-400">
                            {plataforma.pantallas.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
