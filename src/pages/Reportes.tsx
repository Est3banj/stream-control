import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useVentas from '../hooks/useVentas';
import { useMoneda } from '../hooks/useMoneda';
import usePermisos from '../hooks/usePermisos';
import FeatureBlocked from '../components/FeatureBlocked';
import Paginador from '../components/Paginador';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Search, Download, DollarSign, TrendingUp, TrendingDown, Calendar, Filter, X, AlertCircle, Users, UserPlus, Layers } from 'lucide-react';
import PlataformaBadge from '../components/PlataformaBadge';
import toast from 'react-hot-toast';
import type { Venta } from '../types/venta';

export default function Reportes() {
  const { user } = useAuth();
  const permisos = usePermisos(user);
  const { ventas: todasLasVentas, loading, error } = useVentas(user);
  const { formatear, formatearDesdeVenta, convertirVenta } = useMoneda();
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const [itemsPorPagina, setItemsPorPagina] = useState(10);
  const [tipoVenta, setTipoVenta] = useState<'todas' | 'clientes' | 'subdistribuidor'>('todas');

  // Filtro por rango de fechas (solo client-side, sin reiniciar el listener)
  const ventas = useMemo(() => {
    let data = todasLasVentas as Venta[];

    if (tipoVenta === 'clientes') {
      data = data.filter(v => !v.esSubdistribuidor);
    } else if (tipoVenta === 'subdistribuidor') {
      data = data.filter(v => v.esSubdistribuidor);
    }

    if (fechaInicio && fechaFin) {
      data = data.filter((v: Venta) => {
        let fechaStr: string | undefined;
        if (v.fechaVenta) {
          fechaStr = v.fechaVenta;
        } else if (v.fechaRegistro?.seconds) {
          const d = new Date(v.fechaRegistro.seconds * 1000);
          fechaStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        } else {
          return false;
        }
        return fechaStr >= fechaInicio && fechaStr <= fechaFin;
      });
    }

    return data;
  }, [todasLasVentas, fechaInicio, fechaFin, tipoVenta]);

  // Resetear página al cambiar filtros (hook ANTES del early return)
  useEffect(() => {
    setPaginaActual(1);
  }, [fechaInicio, fechaFin, searchTerm]);

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
      'Fecha Venta': v.fechaVenta
        ? new Date(v.fechaVenta + 'T00:00:00').toLocaleDateString()
        : v.fechaRegistro?.seconds
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
      <div className="flex items-center justify-center min-h-[60vh] text-slate-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
          <p className="text-slate-400 font-medium">Cargando reportes...</p>
        </div>
      </div>
    );
  }

  if (!permisos.puedeVerReportesAvanzados) {
    return (
      <div className="space-y-6 animate-fade-in text-slate-100">
        <div className="mb-6">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
            Reportes
          </h1>
          <p className="text-slate-400">Reportes avanzados y exportación de datos</p>
        </div>
        <FeatureBlocked
          feature="Reportes Avanzados"
          description="Analizá tus ventas con filtros por fecha, búsqueda avanzada y exportación a Excel."
          plan="Professional y Enterprise"
        />
      </div>
    );
  }

  const filteredVentas = ventas
    .filter(v => {
      const term = searchTerm.toLowerCase();
      return (
        v.nombre?.toLowerCase().includes(term) ||
        v.plataforma?.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      // Más recientes primero (fechaVenta DESC)
      const dateA = a.fechaVenta
        ? new Date(a.fechaVenta + 'T00:00:00').getTime()
        : a.fechaRegistro?.seconds
          ? new Date(a.fechaRegistro.seconds * 1000).getTime()
          : 0;
      const dateB = b.fechaVenta
        ? new Date(b.fechaVenta + 'T00:00:00').getTime()
        : b.fechaRegistro?.seconds
          ? new Date(b.fechaRegistro.seconds * 1000).getTime()
          : 0;
      return dateB - dateA;
    });

  const indexUltimo = paginaActual * itemsPorPagina;
  const indexPrimero = indexUltimo - itemsPorPagina;
  const ventasPaginadas = filteredVentas.slice(indexPrimero, indexUltimo);

  const totalIngresos = ventas.reduce((acc, v) => acc + convertirVenta((v.precioVenta * v.pantallas) || 0, v.monedaVenta, v.tasaVenta), 0);
  const totalCostos = ventas.reduce((acc, v) => acc + convertirVenta(Number(v.costoServicio || 0), v.monedaVenta, v.tasaVenta), 0);
  const totalUtilidad = totalIngresos - totalCostos;
  const esAdmin = user?.rol === 'admin';
  const colCount = esAdmin ? 9 : 8;
  const totalVentas = ventas.length;
  const promedioPorVenta = totalVentas > 0 ? totalIngresos / totalVentas : 0;
  const vendedoresActivos = new Set(ventas.map(v => v.usuarioEmail).filter(Boolean)).size;

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {error && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 flex items-center gap-3 text-rose-300">
          <AlertCircle className="text-rose-400 shrink-0" size={20} />
          <p className="text-sm">{error}</p>
        </div>
      )}
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
          {esAdmin ? 'Reportes de la Plataforma' : 'Reportes de Ventas'}
        </h1>
        <p className="text-slate-400">Analiza y exporta tus datos de ventas</p>
      </div>

      {/* Tabs: Clientes / Sub-distribuidor */}
      <div className="flex gap-4 flex-wrap">
        {([
          { key: 'todas', label: 'Todas las ventas', icon: Layers },
          { key: 'clientes', label: 'Ventas Cliente', icon: Users },
          { key: 'subdistribuidor', label: 'Venta Sub-distribuidor', icon: UserPlus },
        ] as const).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setTipoVenta(tab.key)}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
                tipoVenta === tab.key
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/50'
                  : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl p-6 space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <Filter className="text-indigo-400" size={20} />
          <h2 className="text-lg font-semibold text-white">Filtros</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              <Calendar size={16} className="inline mr-1" />
              Desde
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFechaInicio(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              <Calendar size={16} className="inline mr-1" />
              Hasta
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFechaFin(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                placeholder="Cliente o Plataforma"
                className="w-full pl-10 bg-slate-900/80 border border-slate-700/80 text-slate-100 placeholder-slate-500"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="block text-sm font-semibold text-slate-300 mb-2 opacity-0">Acciones</label>
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
        <div className="card cursor-default">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md flex items-center justify-center">
              <DollarSign className="text-white" size={22} />
            </div>
            <TrendingUp className="text-emerald-400" size={24} />
          </div>
          <p className="text-sm font-medium text-slate-400 mb-1">Ingresos Totales</p>
          <p className="text-3xl font-bold text-emerald-400">{formatear(totalIngresos)}</p>
        </div>

        <div className="card cursor-default">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 shadow-md flex items-center justify-center">
              <DollarSign className="text-white" size={22} />
            </div>
            <TrendingDown className="text-rose-400" size={24} />
          </div>
          <p className="text-sm font-medium text-slate-400 mb-1">Costos Totales</p>
          <p className="text-3xl font-bold text-rose-400">{formatear(totalCostos)}</p>
        </div>

        <div className="card cursor-default">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-md flex items-center justify-center">
              <TrendingUp className="text-white" size={22} />
            </div>
            <div className={`text-2xl font-bold ${totalUtilidad >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalUtilidad >= 0 ? '↑' : '↓'}
            </div>
          </div>
          <p className="text-sm font-medium text-slate-400 mb-1">Utilidad Total</p>
          <p className={`text-3xl font-bold ${totalUtilidad >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
            {formatear(totalUtilidad)}
          </p>
        </div>
      </div>

      {esAdmin ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="card cursor-default">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-md flex items-center justify-center">
                <DollarSign className="text-white" size={22} />
              </div>
              <TrendingUp className="text-indigo-400" size={24} />
            </div>
            <p className="text-sm font-medium text-slate-400 mb-1">Promedio por Venta</p>
            <p className="text-3xl font-bold text-white">{formatear(promedioPorVenta)}</p>
          </div>

          <div className="card cursor-default">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-md flex items-center justify-center">
                <DollarSign className="text-white" size={22} />
              </div>
              <TrendingUp className="text-indigo-400" size={24} />
            </div>
            <p className="text-sm font-medium text-slate-400 mb-1">Total Ventas</p>
            <p className="text-3xl font-bold text-white">{totalVentas.toLocaleString()}</p>
          </div>

          <div className="card cursor-default">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-md flex items-center justify-center">
                <Users className="text-white" size={22} />
              </div>
              <TrendingUp className="text-indigo-400" size={24} />
            </div>
            <p className="text-sm font-medium text-slate-400 mb-1">Vendedores Activos</p>
            <p className="text-3xl font-bold text-white">{vendedoresActivos}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Tabla de ventas */}
          <div className="bg-slate-900/80 rounded-2xl shadow-xl border border-slate-800 overflow-hidden text-slate-100">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white">Historial de Ventas</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 uppercase tracking-wider text-xs">
                    <th className="px-4 py-4 text-left font-semibold">Cliente</th>
                    <th className="px-4 py-4 text-left font-semibold">Plataforma</th>
                    <th className="px-4 py-4 text-center font-semibold">Pantallas</th>
                    <th className="px-4 py-4 text-right font-semibold">Ingreso</th>
                    <th className="px-4 py-4 text-right font-semibold">Costo</th>
                    <th className="px-4 py-4 text-right font-semibold">Utilidad</th>
                    {esAdmin && <th className="px-4 py-4 text-left font-semibold">Registrado por</th>}
                    <th className="px-4 py-4 text-left font-semibold">Fecha Venta</th>
                    <th className="px-4 py-4 text-left font-semibold">Vencimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVentas.length > 0 ? (
                    ventasPaginadas.map((v: Venta) => (
                      <tr
                        key={v.id}
                        className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-4 py-4 font-medium text-white">{v.nombre}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <PlataformaBadge plataforma={v.plataforma} />
                            {v.grupoId && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-800/40 text-xs font-semibold whitespace-nowrap" title={`ID de grupo: ${v.grupoId.slice(0, 8)}…`}>
                                Combo
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center text-slate-300">{v.pantallas}</td>
                        <td className="px-4 py-4 text-right font-semibold text-emerald-400">
                          {formatearDesdeVenta((v.precioVenta || 0) * (v.pantallas || 0), v.monedaVenta, v.tasaVenta)}
                        </td>
                        <td className="px-4 py-4 text-right text-slate-300">
                          {formatearDesdeVenta(Number(v.costoServicio || 0), v.monedaVenta, v.tasaVenta)}
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-cyan-300">
                          {formatearDesdeVenta(Number(v.utilidad || 0), v.monedaVenta, v.tasaVenta)}
                        </td>
                        {esAdmin && <td className="px-4 py-4 text-slate-400">{v.usuarioEmail || '—'}</td>}
                        <td className="px-4 py-4 text-slate-300">
                          {v.fechaVenta
                            ? new Date(v.fechaVenta + 'T00:00:00').toLocaleDateString('es-CO')
                            : v.fechaRegistro?.seconds
                              ? new Date(v.fechaRegistro.seconds * 1000).toLocaleDateString('es-CO')
                              : '—'}
                        </td>
                        <td className="px-4 py-4">
                          {v.fechaVencimiento ? (
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-indigo-400" />
                              <span className="text-slate-200 font-medium">
                                {new Date(v.fechaVencimiento).toLocaleDateString('es-CO')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={colCount} className="text-center py-12 text-slate-500">
                        <p className="font-medium">No se encontraron ventas en el rango seleccionado</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginación */}
          <Paginador
            currentPage={paginaActual}
            totalItems={filteredVentas.length}
            itemsPerPage={itemsPorPagina}
            onPageChange={setPaginaActual}
            onItemsPerPageChange={(val: number) => {
              setItemsPorPagina(val);
              setPaginaActual(1);
            }}
          />
        </>
      )}
    </div>
  );
}
