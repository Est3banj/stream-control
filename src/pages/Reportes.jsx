import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useVentas from '../hooks/useVentas';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Search, Download, DollarSign, TrendingUp, TrendingDown, Calendar, Filter, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Reportes() {
  const { user } = useAuth();
  const { ventas: todasLasVentas, loading } = useVentas(user);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Filtro por rango de fechas (solo client-side, sin reiniciar el listener)
  const ventas = useMemo(() => {
    let data = todasLasVentas;

    if (fechaInicio && fechaFin) {
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);
      fin.setHours(23, 59, 59, 999);

      data = data.filter((v) => {
        if (!v.fechaRegistro?.seconds) return false;
        const fechaVenta = new Date(v.fechaRegistro.seconds * 1000);
        return fechaVenta >= inicio && fechaVenta <= fin;
      });
    }

    return data;
  }, [todasLasVentas, fechaInicio, fechaFin]);

  // 🔹 Función para exportar a Excel
  const exportarExcel = () => {
    if (ventas.length === 0) {
      toast.error('No hay ventas para exportar');
      return;
    }

    const datosExportar = ventas.map(v => ({
      Cliente: v.nombre || '',
      Plataforma: v.plataforma || '',
      Pantallas: v.pantallas || 0,
      Ingreso: (v.precioVenta * v.pantallas) || 0,
      Costo: v.costoServicio || 0,
      Utilidad: v.utilidad || 0,
      'Fecha Venta': v.fechaRegistro?.seconds
        ? new Date(v.fechaRegistro.seconds * 1000).toLocaleDateString()
        : '—',
      'Fecha Vencimiento': v.fechaVencimiento
        ? new Date(v.fechaVencimiento).toLocaleDateString()
        : '—',
    }));

    const ws = XLSX.utils.json_to_sheet(datosExportar);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Ventas');

    const nombreArchivo = `Reporte_Ventas_${new Date().toISOString().slice(0,10)}.xlsx`;
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, nombreArchivo);
    toast.success('Excel exportado correctamente');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando reportes...</p>
        </div>
      </div>
    );
  }

  const filteredVentas = ventas.filter(v => {
    const term = searchTerm.toLowerCase();
    return (
      v.nombre?.toLowerCase().includes(term) ||
      v.plataforma?.toLowerCase().includes(term)
    );
  });

  const totalIngresos = ventas.reduce((acc, v) => acc + (v.precioVenta * v.pantallas), 0);
  const totalCostos = ventas.reduce((acc, v) => acc + Number(v.costoServicio || 0), 0);
  const totalUtilidad = totalIngresos - totalCostos;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600">
          Reportes de Ventas
        </h1>
        <p className="text-gray-600">Analiza y exporta tus datos de ventas</p>
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="text-indigo-600" size={20} />
          <h2 className="text-lg font-semibold text-gray-900">Filtros</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Calendar size={16} className="inline mr-1" />
              Desde
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Calendar size={16} className="inline mr-1" />
              Hasta
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Search size={16} className="inline mr-1" />
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cliente o Plataforma"
                className="w-full pl-10"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2 opacity-0">Acciones</label>
            <div className="flex gap-2">
              <button
                onClick={() => { setFechaInicio(''); setFechaFin(''); setSearchTerm(''); }}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <X size={18} />
                <span className="hidden sm:inline">Limpiar</span>
              </button>
              <button
                onClick={exportarExcel}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Download size={18} />
                <span className="hidden sm:inline">Excel</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
              <DollarSign className="text-white" size={24} />
            </div>
            <TrendingUp className="text-green-500" size={24} />
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Ingresos Totales</p>
          <p className="text-3xl font-bold text-green-600">${totalIngresos.toLocaleString()}</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center">
              <DollarSign className="text-white" size={24} />
            </div>
            <TrendingDown className="text-red-500" size={24} />
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Costos Totales</p>
          <p className="text-3xl font-bold text-red-600">${totalCostos.toLocaleString()}</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <TrendingUp className="text-white" size={24} />
            </div>
            <div className={`text-2xl font-bold ${totalUtilidad >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalUtilidad >= 0 ? '↑' : '↓'}
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Utilidad Total</p>
          <p className={`text-3xl font-bold ${totalUtilidad >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
            ${totalUtilidad.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Tabla de ventas */}
      <div className="card overflow-hidden p-0">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Historial de Ventas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                <th className="px-4 py-4 text-left text-sm font-semibold">Cliente</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Plataforma</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Pantallas</th>
                <th className="px-4 py-4 text-right text-sm font-semibold">Ingreso</th>
                <th className="px-4 py-4 text-right text-sm font-semibold">Costo</th>
                <th className="px-4 py-4 text-right text-sm font-semibold">Utilidad</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Fecha Venta</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Vencimiento</th>
              </tr>
            </thead>
            <tbody>
              {filteredVentas.length > 0 ? (
                filteredVentas.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-gray-100 hover:bg-indigo-50/50 transition-all duration-200"
                  >
                    <td className="px-4 py-4 font-medium text-gray-900">{v.nombre}</td>
                    <td className="px-4 py-4">
                      <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-medium">
                        {v.plataforma}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-gray-700">{v.pantallas}</td>
                    <td className="px-4 py-4 text-right font-semibold text-green-600">
                      ${((v.precioVenta || 0) * (v.pantallas || 0)).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-red-600">
                      ${Number(v.costoServicio || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-indigo-600">
                      ${Number(v.utilidad || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      {v.fechaRegistro?.seconds
                        ? new Date(v.fechaRegistro.seconds * 1000).toLocaleDateString('es-CO')
                        : '—'}
                    </td>
                    <td className="px-4 py-4">
                      {v.fechaVencimiento ? (
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-indigo-500" />
                          <span className="text-gray-700 font-medium">
                            {new Date(v.fechaVencimiento).toLocaleDateString('es-CO')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-gray-500">
                    <p className="font-medium">No se encontraron ventas en el rango seleccionado</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}