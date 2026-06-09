import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useVentas from '../hooks/useVentas';
import { DollarSign, TrendingUp, TrendingDown, Users, Tv } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#6B21A8', '#3B82F6', '#06B6D4', '#8B5CF6', '#EC4899'];

export default function Dashboard() {
  const { user } = useAuth();
  const { ventas, loading } = useVentas(user);
  const [totales, setTotales] = useState({ ingresos: 0, egresos: 0, utilidad: 0 });
  const [topClientes, setTopClientes] = useState([]);
  const [topPlataformas, setTopPlataformas] = useState([]);

  // Procesar ventas cuando cambian
  useEffect(() => {
    if (loading || !ventas.length) return;

    let ingresos = 0, costos = 0, utilidad = 0;
    const clientes = {};
    const plataformas = {};

    ventas.forEach((v) => {
      const ingresoVenta = (v.precioVenta * v.pantallas) || 0;
      ingresos += ingresoVenta;
      costos += Number(v.costoServicio) || 0;
      utilidad += Number(v.utilidad) || 0;

      if (v.nombre) {
        clientes[v.nombre] = (clientes[v.nombre] || 0) + ingresoVenta;
      }
      if (v.plataforma) {
        plataformas[v.plataforma] = (plataformas[v.plataforma] || 0) + (v.pantallas || 0);
      }
    });

    setTotales({ ingresos, egresos: costos, utilidad });

    const topClientesSorted = Object.entries(clientes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, ventas]) => ({ nombre, ventas }));
    setTopClientes(topClientesSorted);

    const topPlataformasSorted = Object.entries(plataformas)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([plataforma, pantallas]) => ({ plataforma, pantallas }));
    setTopPlataformas(topPlataformasSorted);
  }, [ventas, loading]);

  // Datos para gráfico de barras de clientes
  const clientesChartData = useMemo(() => {
    return topClientes.map((item, index) => ({
      name: item.nombre.length > 15 ? item.nombre.substring(0, 15) + '...' : item.nombre,
      ventas: item.ventas,
      fullName: item.nombre,
    }));
  }, [topClientes]);

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
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Título */}
      <div className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600">
          Dashboard
        </h1>
        <p className="text-gray-600">Resumen de tus ventas y métricas principales</p>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Ingresos */}
        <div className="card group hover:scale-105 transition-all duration-300 cursor-default">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <DollarSign className="text-white" size={28} />
            </div>
            <TrendingUp className="text-green-500" size={24} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Ingresos</p>
            <p className="text-3xl font-bold text-gray-900">${totales.ingresos.toLocaleString()}</p>
          </div>
        </div>

        {/* Egresos */}
        <div className="card group hover:scale-105 transition-all duration-300 cursor-default">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 to-red-600 flex items-center justify-center shadow-lg">
              <DollarSign className="text-white" size={28} />
            </div>
            <TrendingDown className="text-red-500" size={24} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Egresos</p>
            <p className="text-3xl font-bold text-gray-900">${totales.egresos.toLocaleString()}</p>
          </div>
        </div>

        {/* Utilidad */}
        <div className="card group hover:scale-105 transition-all duration-300 cursor-default">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center shadow-lg">
              <TrendingUp className="text-white" size={28} />
            </div>
            <div className={`text-2xl font-bold ${totales.utilidad >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totales.utilidad >= 0 ? '↑' : '↓'}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Utilidad</p>
            <p className={`text-3xl font-bold ${totales.utilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${totales.utilidad.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Gráfico de barras - Top Clientes */}
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <Users className="text-indigo-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Top 5 Clientes por Ventas</h2>
          </div>
          {clientesChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={clientesChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [`$${value.toLocaleString()}`, 'Ventas']}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                />
                <Bar dataKey="ventas" fill="#6B21A8" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              <p>No hay datos disponibles</p>
            </div>
          )}
        </div>

        {/* Gráfico de pie - Top Plataformas */}
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <Tv className="text-purple-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Top 5 Plataformas</h2>
          </div>
          {plataformasChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={plataformasChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {plataformasChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} pantallas`, 'Cantidad']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
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
            <Users className="text-indigo-600" size={20} />
            <h3 className="text-lg font-semibold text-gray-900">Clientes Destacados</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                  <th className="px-4 py-3 text-left text-sm font-semibold rounded-tl-xl">Cliente</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold rounded-tr-xl">Ventas</th>
                </tr>
              </thead>
              <tbody>
                {topClientes.length === 0 ? (
                  <tr>
                    <td colSpan="2" className="text-center py-8 text-gray-500">No hay datos</td>
                  </tr>
                ) : (
                  topClientes.map((cliente, index) => (
                    <tr
                      key={cliente.nombre}
                      className="border-b border-gray-100 hover:bg-indigo-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-700">{cliente.nombre}</td>
                      <td className="px-4 py-3 text-right font-semibold text-indigo-600">
                        ${cliente.ventas.toLocaleString()}
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
            <Tv className="text-purple-600" size={20} />
            <h3 className="text-lg font-semibold text-gray-900">Plataformas Populares</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-purple-500 to-pink-600 text-white">
                  <th className="px-4 py-3 text-left text-sm font-semibold rounded-tl-xl">Plataforma</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold rounded-tr-xl">Pantallas</th>
                </tr>
              </thead>
              <tbody>
                {topPlataformas.length === 0 ? (
                  <tr>
                    <td colSpan="2" className="text-center py-8 text-gray-500">No hay datos</td>
                  </tr>
                ) : (
                  topPlataformas.map((plataforma, index) => (
                    <tr
                      key={plataforma.plataforma}
                      className="border-b border-gray-100 hover:bg-purple-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-700">{plataforma.plataforma}</td>
                      <td className="px-4 py-3 text-right font-semibold text-purple-600">
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
    </div>
  );
}