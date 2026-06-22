import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useCuentas, { crearCuenta, actualizarCuenta, toggleCuentaActiva } from '../hooks/useCuentas';
import usePermisos from '../hooks/usePermisos';
import CuentaForm from '../components/CuentaForm';
import CuentaDetail from '../components/CuentaDetail';
import FeatureBlocked from '../components/FeatureBlocked';
import Paginador from '../components/Paginador';
import toast from 'react-hot-toast';
import { Search, Eye, Edit, EyeOff, Users, CheckCircle, AlertCircle, AlertTriangle, Film, X, Download } from 'lucide-react';
import type { Cuenta, CreateCuentaInput } from '../types/cuenta';

const PROVEEDORES = ['Todos', 'Netflix', 'Max', 'Disney+', 'Prime Video', 'ChatGPT', 'Win Sports+', 'Universal+', 'Paramount+', 'Otro'];

const ESTADO_BADGES: Record<string, { label: string; class: string }> = {
  disponible: { label: 'Disponible', class: 'bg-green-100 text-green-700' },
  asignada: { label: 'Asignada', class: 'bg-blue-100 text-blue-700' },
  expirada: { label: 'Expirada', class: 'bg-red-100 text-red-700' },
};

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [name, domain] = email.split('@');
  const maskedName = name.length > 4 ? name.slice(0, 4) + '***' : name.slice(0, 1) + '***';
  return `${maskedName}@${domain}`;
}

export default function GestionCuentas() {
  const { user } = useAuth();
  const { cuentas: todasLasCuentas, loading, error } = useCuentas(user);
  const permisos = usePermisos(user);

  const [busqueda, setBusqueda] = useState('');
  const [filtroProveedor, setFiltroProveedor] = useState('Todos');
  const [filtroEstado, setFiltroEstado] = useState<'todas' | 'disponible' | 'asignada' | 'expirada'>('todas');
  const [paginaActual, setPaginaActual] = useState(1);
  const [itemsPorPagina, setItemsPorPagina] = useState(10);

  const [mostrarRegistrar, setMostrarRegistrar] = useState(false);
  const [mostrarVer, setMostrarVer] = useState(false);
  const [mostrarEditar, setMostrarEditar] = useState(false);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<Cuenta | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, filtroProveedor, filtroEstado]);

  const cuentasFiltradas = todasLasCuentas.filter(c => {
    if (filtroProveedor !== 'Todos' && c.proveedor !== filtroProveedor) return false;
    if (filtroEstado !== 'todas' && c.estado !== filtroEstado) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (!c.proveedor.toLowerCase().includes(q) && !c.correoCuenta.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const indexUltimo = paginaActual * itemsPorPagina;
  const indexPrimero = indexUltimo - itemsPorPagina;
  const cuentasPaginadas = cuentasFiltradas.slice(indexPrimero, indexUltimo);

  const resumenProveedores = todasLasCuentas.reduce<Record<string, number>>((acc, c) => {
    acc[c.proveedor] = (acc[c.proveedor] || 0) + 1;
    return acc;
  }, {});

  const cuentasDisponibles = todasLasCuentas.filter(c => c.estado === 'disponible').length;
  const cuentasAsignadas = todasLasCuentas.filter(c => c.estado === 'asignada').length;
  const cuentasExpiradas = todasLasCuentas.filter(c => c.estado === 'expirada').length;

  const handleCrearCuenta = async (data: CreateCuentaInput | Partial<Cuenta>) => {
    if (!user) return;
    setGuardando(true);
    try {
      const input = data as CreateCuentaInput;
      input.propietarioId = user.uid || '';
      await crearCuenta(input);
      toast.success('Cuenta registrada correctamente');
      setMostrarRegistrar(false);
    } catch (err: unknown) {
      console.error('Error creando cuenta:', err);
      toast.error('Error al registrar la cuenta');
    } finally {
      setGuardando(false);
    }
  };

  const handleEditarCuenta = async (data: Partial<Cuenta>) => {
    if (!cuentaSeleccionada) return;
    setGuardando(true);
    try {
      await actualizarCuenta(cuentaSeleccionada.id, data);
      toast.success('Cuenta actualizada correctamente');
      setMostrarEditar(false);
      setCuentaSeleccionada(null);
    } catch (err: unknown) {
      console.error('Error actualizando cuenta:', err);
      toast.error('Error al actualizar la cuenta');
    } finally {
      setGuardando(false);
    }
  };

  const handleToggleEstado = async (cuenta: Cuenta) => {
    try {
      const nuevoEstado = cuenta.estado === 'expirada' ? 'disponible' : 'expirada';
      await actualizarCuenta(cuenta.id, { estado: nuevoEstado });
      toast.success(`Cuenta ${nuevoEstado === 'expirada' ? 'desactivada' : 'reactivada'} correctamente`);
    } catch (err: unknown) {
      console.error('Error cambiando estado:', err);
      toast.error('Error al cambiar estado de la cuenta');
    }
  };

  const exportarCSV = () => {
    if (!cuentasFiltradas.length) {
      toast.error('No hay cuentas para exportar');
      return;
    }
    const encabezados = ['Proveedor', 'Correo', 'Costo', 'Tipo Venta', 'Perfiles', 'Disponibles', 'Estado'];
    const filas = cuentasFiltradas.map(c => [
      c.proveedor,
      c.correoCuenta,
      c.costo,
      c.tipoVenta,
      c.perfiles.length,
      c.perfiles.filter(p => p.estado === 'disponible').length,
      c.estado,
    ]);
    const csvContent = [encabezados, ...filas].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `cuentas_${new Date().toISOString().split('T')[0]}.csv`;
    enlace.click();
    toast.success('CSV exportado correctamente');
  };

  if (!permisos.puedeGestionarCuentas) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-700">
            Gestión de Cuentas
          </h1>
          <p className="text-gray-600">Administrá tus cuentas de streaming</p>
        </div>
        <FeatureBlocked
          feature="Gestión de Cuentas"
          description="Administrá cuentas de streaming, asigná perfiles y gestioná el inventario de tus servicios."
          plan="Professional"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando cuentas...</p>
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

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-700">
            Gestión de Cuentas
          </h1>
          <p className="text-gray-600">Administrá tus cuentas de streaming</p>
        </div>
        <button
          onClick={() => setMostrarRegistrar(true)}
          className="btn-primary"
        >
          + Registrar Cuenta
        </button>
      </div>

      {/* Controles */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* Filtro por proveedor */}
          <select
            value={filtroProveedor}
            onChange={(e) => setFiltroProveedor(e.target.value)}
            className="w-full md:w-48"
          >
            {PROVEEDORES.map(p => (
              <option key={p} value={p}>{p === 'Todos' ? 'Todos los proveedores' : p}</option>
            ))}
          </select>

          {/* Filtro por estado */}
          <div className="flex gap-2 flex-wrap">
            {(['todas', 'disponible', 'asignada', 'expirada'] as const).map((tipo) => (
              <button
                key={tipo}
                onClick={() => setFiltroEstado(tipo)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filtroEstado === tipo
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg'
                    : 'bg-white/80 text-gray-700 hover:bg-white'
                  }`}
              >
                {tipo === 'todas' ? 'Todas' : tipo.charAt(0).toUpperCase() + tipo.slice(1)}
              </button>
            ))}
          </div>

          {/* Búsqueda */}
          <div className="flex-1 relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por proveedor o correo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4"
            />
          </div>

          {/* Exportar */}
          <button
            onClick={exportarCSV}
            className="btn-secondary flex items-center gap-2 whitespace-nowrap"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card cursor-default">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Film className="text-white" size={24} />
            </div>
            <Film className="text-indigo-400" size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Total Cuentas</p>
            <p className="text-2xl font-bold text-gray-900">{todasLasCuentas.length.toLocaleString()}</p>
          </div>
        </div>
        <div className="card cursor-default">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center shadow-lg">
              <CheckCircle className="text-white" size={24} />
            </div>
            <CheckCircle className="text-green-400" size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Disponibles</p>
            <p className="text-2xl font-bold text-gray-900">{cuentasDisponibles.toLocaleString()}</p>
          </div>
        </div>
        <div className="card cursor-default">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
              <Users className="text-white" size={24} />
            </div>
            <Users className="text-blue-400" size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Asignadas</p>
            <p className="text-2xl font-bold text-gray-900">{cuentasAsignadas.toLocaleString()}</p>
          </div>
        </div>
        <div className="card cursor-default">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow-lg">
              <AlertTriangle className="text-white" size={24} />
            </div>
            <AlertTriangle className="text-red-400" size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Expiradas</p>
            <p className="text-2xl font-bold text-gray-900">{cuentasExpiradas.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Por proveedor */}
      {Object.keys(resumenProveedores).length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(resumenProveedores).sort().map(([prov, count]) => (
              <span
                key={prov}
                className="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium border border-indigo-100"
              >
                {prov}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-indigo-600 text-white">
                <th className="px-4 py-4 text-left text-sm font-semibold">Proveedor</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Correo</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Perfiles</th>
                <th className="px-4 py-4 text-right text-sm font-semibold">Costo</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Estado</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cuentasFiltradas.length > 0 ? (
                cuentasPaginadas.map((c: Cuenta) => {
                  const badge = ESTADO_BADGES[c.estado] || { label: c.estado, class: 'bg-gray-100 text-gray-700' };
                  const perfilesDisp = c.perfiles.filter(p => p.estado === 'disponible').length;
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-gray-100 hover:bg-indigo-50/30 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <span className="font-semibold text-gray-900">{c.proveedor}</span>
                        <div className="text-xs text-gray-500 mt-0.5">{c.tipoVenta === 'completa' ? 'Completa' : 'Por perfiles'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-gray-700 text-sm font-mono" title={c.correoCuenta}>
                          {maskEmail(c.correoCuenta)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-gray-700 font-medium">
                          {c.tipoVenta === 'completa' ? (
                            '—'
                          ) : (
                            <>{perfilesDisp} / {c.perfiles.length}</>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-semibold text-gray-900">
                          ${c.costo.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${badge.class}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setCuentaSeleccionada(c);
                              setMostrarVer(true);
                            }}
                            className="p-2 rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors"
                            title="Ver cuenta"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => {
                              setCuentaSeleccionada(c);
                              setMostrarEditar(true);
                            }}
                            className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                            title="Editar cuenta"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleToggleEstado(c)}
                            className={`p-2 rounded-lg transition-colors ${
                              c.estado === 'expirada'
                                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                : 'bg-red-100 text-red-600 hover:bg-red-200'
                            }`}
                            title={c.estado === 'expirada' ? 'Reactivar cuenta' : 'Desactivar cuenta'}
                          >
                            {c.estado === 'expirada' ? <Eye size={18} /> : <EyeOff size={18} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500">
                    <Film size={48} className="mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">No se encontraron cuentas</p>
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
        totalItems={cuentasFiltradas.length}
        itemsPerPage={itemsPorPagina}
        onPageChange={setPaginaActual}
        onItemsPerPageChange={(val: number) => {
          setItemsPorPagina(val);
          setPaginaActual(1);
        }}
      />

      {/* Modal: Registrar Cuenta */}
      {mostrarRegistrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Registrar Cuenta</h2>
                <p className="text-gray-600 mt-1">Agregá una nueva cuenta de streaming</p>
              </div>
              <button
                onClick={() => setMostrarRegistrar(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>
            <CuentaForm
              onSubmit={handleCrearCuenta}
              onCancel={() => setMostrarRegistrar(false)}
              loading={guardando}
            />
          </div>
        </div>
      )}

      {/* Modal: Ver Cuenta */}
      {mostrarVer && cuentaSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{cuentaSeleccionada.proveedor}</h2>
                <p className="text-gray-600 mt-1">Detalle de la cuenta</p>
              </div>
              <button
                onClick={() => {
                  setMostrarVer(false);
                  setCuentaSeleccionada(null);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>
            <CuentaDetail cuenta={cuentaSeleccionada} />
          </div>
        </div>
      )}

      {/* Modal: Editar Cuenta */}
      {mostrarEditar && cuentaSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Editar Cuenta</h2>
                <p className="text-gray-600 mt-1">{cuentaSeleccionada.proveedor} — {maskEmail(cuentaSeleccionada.correoCuenta)}</p>
              </div>
              <button
                onClick={() => {
                  setMostrarEditar(false);
                  setCuentaSeleccionada(null);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>
            <CuentaForm
              initialData={cuentaSeleccionada}
              onSubmit={handleEditarCuenta}
              onCancel={() => {
                setMostrarEditar(false);
                setCuentaSeleccionada(null);
              }}
              loading={guardando}
            />
          </div>
        </div>
      )}
    </div>
  );
}
