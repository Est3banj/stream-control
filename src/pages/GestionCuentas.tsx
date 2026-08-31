import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useCuentas, { crearCuenta, actualizarCuenta, asignarPerfil } from '../hooks/useCuentas';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { callFunction } from '../lib/apiClient';
import { db } from '../firebase';
import usePermisos from '../hooks/usePermisos';
import useClientes from '../hooks/useClientes';
import { useMoneda } from '../hooks/useMoneda';
import CuentaForm from '../components/CuentaForm';
import CuentaDetail from '../components/CuentaDetail';
import ConfigurarIMAP from '../components/ConfigurarIMAP';
import FeatureBlocked from '../components/FeatureBlocked';
import Paginador from '../components/Paginador';
import DropdownMenu from '../components/DropdownMenu';
import toast from 'react-hot-toast';
import { Search, Eye, Edit, EyeOff, Users, CheckCircle, AlertCircle, AlertTriangle, Film, X, Download, Key, Link, Check, RefreshCw, Copy, Ticket } from 'lucide-react';
import type { Cuenta, CreateCuentaInput } from '../types/cuenta';
import { ESTADO_BADGES, maskEmail } from '../constants';

const PROVEEDORES = ['Todos', 'Netflix', 'Max', 'Disney+', 'Prime Video', 'ChatGPT', 'Win Sports+', 'Universal+', 'Paramount+', 'Otro'];

export default function GestionCuentas() {
  const { user } = useAuth();
  const { cuentas: todasLasCuentas, loading, error } = useCuentas(user);
  const permisos = usePermisos(user);
  const { clientes: todosLosClientes, loading: loadingClientes } = useClientes(user);
  const { formatear } = useMoneda();

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
  const [confirmarAccion, setConfirmarAccion] = useState<{ cuenta: Cuenta; accion: 'desactivar' | 'reactivar' } | null>(null);
  const [mostrarIMAP, setMostrarIMAP] = useState(false);
  const [mostrarDatosCuenta, setMostrarDatosCuenta] = useState(false);
  const [datosCuenta, setDatosCuenta] = useState<{ proveedor: string; correoCuenta: string; correo: string; contrasena: string; perfiles: Array<{ nombre: string; pin?: string; estado: string }> } | null>(null);
  const [cuentaTicket, setCuentaTicket] = useState<Cuenta | null>(null);
  const [copiadoTicket, setCopiadoTicket] = useState(false);
  const [mostrarAsignar, setMostrarAsignar] = useState(false);
  const [cuentaAsignando, setCuentaAsignando] = useState<Cuenta | null>(null);
  const [perfilIdxAsignando, setPerfilIdxAsignando] = useState<number>(0);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [mostrarRenovar, setMostrarRenovar] = useState(false);
  const [cuentaRenovar, setCuentaRenovar] = useState<Cuenta | null>(null);
  const [renovarFechaInicio, setRenovarFechaInicio] = useState('');
  const [renovarDiasServicio, setRenovarDiasServicio] = useState('30');
  const [renovando, setRenovando] = useState(false);

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
      const input = data as CreateCuentaInput & { contrasena?: string };
      const { contrasena, ...cuentaData } = input;
      cuentaData.propietarioId = user.uid || '';
      await crearCuenta(cuentaData as CreateCuentaInput, contrasena);
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

  const handleRenovarCuenta = (cuenta: Cuenta) => {
    setCuentaRenovar(cuenta);
    setRenovarFechaInicio(new Date().toISOString().split('T')[0]);
    setRenovarDiasServicio('30');
    setMostrarRenovar(true);
  };

  const handleGenerarTicket = async (cuenta: Cuenta) => {
    try {
      const data = await callFunction<{ cuentaId: string }, {
        proveedor: string;
        correoCuenta: string;
        correo: string;
        contrasena: string;
        perfiles: Array<{ nombre: string; pin?: string; estado: string }>;
      }>('obtenerCredencialesCuenta', { cuentaId: cuenta.id });
      setDatosCuenta(data);
      setCuentaTicket(cuenta);
      setMostrarDatosCuenta(true);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Error al obtener datos de la cuenta');
    }
  };

  const generarTextoTicket = (): string => {
    if (!datosCuenta) return '';
    const lineas: string[] = [
      `📋 *Datos de la Cuenta - ${datosCuenta.proveedor}*`,
      `📧 Correo: ${datosCuenta.correo || datosCuenta.correoCuenta}`,
    ];
    if (datosCuenta.contrasena && datosCuenta.contrasena.trim()) {
      lineas.push(`🔑 Contraseña: ${datosCuenta.contrasena.trim()}`);
    }
    if (datosCuenta.perfiles && datosCuenta.perfiles.length > 0) {
      lineas.push('👤 Perfiles:');
      datosCuenta.perfiles.forEach((p: { nombre: string; pin?: string; estado: string }) => {
        const pinStr = p.pin && p.pin.trim() ? ` (PIN: ${p.pin.trim()})` : '';
        lineas.push(`  - ${p.nombre.trim()}${pinStr}`);
      });
    }
    if (cuentaTicket?.fechaVencimiento) {
      const dias = cuentaTicket.diasRestantes;
      const diasStr = dias !== null && dias !== undefined ? (dias > 0 ? ` (${dias} días)` : ' (Vencido)') : '';
      lineas.push(`⏳ Vencimiento: ${cuentaTicket.fechaVencimiento}${diasStr}`);
    }
    lineas.push('━━━━━━━━━━━━━━━━━━━━━━');
    lineas.push('Generado por StreamControl');
    return lineas.join('\n');
  };

  const copiarTicket = async () => {
    try {
      const texto = generarTextoTicket();
      await navigator.clipboard.writeText(texto);
      setCopiadoTicket(true);
      toast.success('Ticket copiado al portapapeles');
      setTimeout(() => setCopiadoTicket(false), 2000);
    } catch {
      toast.error('No se pudo copiar el ticket');
    }
  };

  const confirmarRenovarCuenta = async () => {
    if (!cuentaRenovar || !renovarFechaInicio || !renovarDiasServicio) return;
    setRenovando(true);
    try {
      const fechaInicio = renovarFechaInicio;
      const dias = Number(renovarDiasServicio);
      if (!dias || dias <= 0) {
        toast.error('Los dias de servicio deben ser mayor a 0');
        setRenovando(false);
        return;
      }
      const fd = new Date(fechaInicio);
      fd.setDate(fd.getDate() + dias);
      const fechaVencimiento = fd.toISOString().split('T')[0];

      // Estado: si tiene perfiles asignados → 'asignada', sino → 'disponible'
      const perfilesAsignados = (cuentaRenovar.perfiles || []).filter(p => p.estado === 'asignado');
      const nuevoEstado = perfilesAsignados.length > 0 ? 'asignada' : 'disponible';

      await actualizarCuenta(cuentaRenovar.id, {
        fechaInicio,
        diasServicio: dias,
        fechaVencimiento,
        estado: nuevoEstado,
        // NO tocamos perfiles — eso preserva las asignaciones existentes
      });

      toast.success(`Cuenta renovada hasta el ${fechaVencimiento}`);
      setMostrarRenovar(false);
      setCuentaRenovar(null);
    } catch (err: unknown) {
      console.error('Error renovando cuenta:', err);
      toast.error('Error al renovar la cuenta');
    } finally {
      setRenovando(false);
    }
  };

  const handleToggleEstado = async (cuenta: Cuenta) => {
    const accion = cuenta.estado === 'expirada' ? 'reactivar' : 'desactivar';
    setConfirmarAccion({ cuenta, accion });
  };

  const [togglendoEstado, setTogglendoEstado] = useState(false);

  const confirmarToggleEstado = async () => {
    if (!confirmarAccion) return;
    const { cuenta, accion } = confirmarAccion;
    setConfirmarAccion(null);
    setTogglendoEstado(true);

    try {
      // Validar: no reactivar si hay perfiles asignados
      if (accion === 'reactivar') {
        const perfilesAsignados = (cuenta.perfiles || []).filter(p => p.estado === 'asignado');
        if (perfilesAsignados.length > 0) {
          toast.error(`No se puede reactivar: ${perfilesAsignados.length} perfil(es) están asignados. Liberalos primero.`);
          setTogglendoEstado(false);
          return;
        }
      }

      const nuevoEstado = accion === 'reactivar' ? 'disponible' : 'expirada';
      await actualizarCuenta(cuenta.id, { estado: nuevoEstado });
      toast.success(`Cuenta ${nuevoEstado === 'expirada' ? 'desactivada' : 'reactivada'} correctamente`);
    } catch (err: unknown) {
      console.error('Error cambiando estado:', err);
      toast.error('Error al cambiar estado de la cuenta');
    } finally {
      setTogglendoEstado(false);
    }
  };

  const handleAsignarPerfil = async (clienteNombre: string) => {
    if (!cuentaAsignando || !user) return;
    setGuardando(true);
    try {
      await asignarPerfil(cuentaAsignando.id, perfilIdxAsignando, clienteNombre, user.uid!);
      toast.success(`Perfil asignado a ${clienteNombre}`);
      setMostrarAsignar(false);
      setCuentaAsignando(null);
    } catch (err) {
      console.error('Error asignando perfil:', err);
      toast.error('Error al asignar el perfil');
    } finally {
      setGuardando(false);
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
      c.perfiles?.length || 0,
      (Array.isArray(c.perfiles) ? c.perfiles.filter(p => p.estado === 'disponible').length : 0),
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
      <div className="space-y-6 animate-fade-in text-slate-100">
        <div className="mb-6">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
            Gestión de Cuentas
          </h1>
          <p className="text-slate-400">Administrá tus cuentas de streaming</p>
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
      <div className="space-y-6 animate-fade-in text-slate-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-10 w-64 bg-slate-800 rounded-xl animate-pulse mb-2" />
            <div className="h-4 w-48 bg-slate-800 rounded animate-pulse" />
          </div>
          <div className="h-10 w-36 bg-slate-800 rounded-xl animate-pulse" />
        </div>
        <div className="bg-slate-900/80 rounded-2xl shadow-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800">
                  {['Proveedor', 'Correo', 'Perfiles', 'Costo', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-4 text-left text-sm font-semibold text-slate-300">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="border-b border-slate-800/60">
                    {[1, 2, 3, 4, 5, 6].map(j => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 bg-slate-800 rounded animate-pulse" style={{ width: j === 3 ? '3rem' : j === 4 ? '5rem' : '7rem' }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
            Gestión de Cuentas
          </h1>
          <p className="text-slate-400">Administrá tus cuentas de streaming</p>
        </div>
        <button
          onClick={() => setMostrarRegistrar(true)}
          className="btn-primary"
        >
          + Registrar Cuenta
        </button>
      </div>

      {/* Controles */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl p-6 text-slate-100">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* Filtro por proveedor */}
          <select
            value={filtroProveedor}
            onChange={(e) => setFiltroProveedor(e.target.value)}
            className="w-full md:w-48 h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100"
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
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/50'
                    : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                {tipo === 'todas' ? 'Todas' : tipo.charAt(0).toUpperCase() + tipo.slice(1)}
              </button>
            ))}
          </div>

          {/* Búsqueda */}
          <div className="flex-1 relative max-w-md w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
            <input
              type="text"
              placeholder="Buscar por proveedor o correo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 placeholder:text-slate-500/70 placeholder:font-normal caret-cyan-400 transition-all duration-150"
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card cursor-default">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-950/50">
              <Film className="text-white" size={24} />
            </div>
            <Film className="text-indigo-400" size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Cuentas</p>
            <p className="text-2xl font-bold text-white">{todasLasCuentas.length.toLocaleString()}</p>
          </div>
        </div>
        <div className="card cursor-default">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-950/50">
              <CheckCircle className="text-white" size={24} />
            </div>
            <CheckCircle className="text-emerald-400" size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Disponibles</p>
            <p className="text-2xl font-bold text-white">{cuentasDisponibles.toLocaleString()}</p>
          </div>
        </div>
        <div className="card cursor-default">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-950/50">
              <Users className="text-white" size={24} />
            </div>
            <Users className="text-indigo-400" size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Asignadas</p>
            <p className="text-2xl font-bold text-white">{cuentasAsignadas.toLocaleString()}</p>
          </div>
        </div>
        <div className="card cursor-default">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-950/50">
              <AlertTriangle className="text-white" size={24} />
            </div>
            <AlertTriangle className="text-rose-400" size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Expiradas</p>
            <p className="text-2xl font-bold text-white">{cuentasExpiradas.toLocaleString()}</p>
          </div>
        </div>
        <div className="card cursor-default">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-950/50">
              <AlertTriangle className="text-white" size={24} />
            </div>
            <AlertTriangle className="text-amber-400" size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Próximas a vencer</p>
            <p className="text-2xl font-bold text-white">
              {todasLasCuentas.filter(c => c.fechaVencimiento && c.diasRestantes !== null && c.diasRestantes! > 0 && c.diasRestantes! <= 3).length}
            </p>
          </div>
        </div>
      </div>

      {/* Por proveedor */}
      {Object.keys(resumenProveedores).length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(resumenProveedores).sort().map(([prov, count]) => (
              <span
                key={prov}
                className="px-3 py-1.5 rounded-full bg-indigo-950/50 text-cyan-300 text-sm font-medium border border-indigo-800/40"
              >
                {prov}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-slate-900/80 rounded-2xl shadow-xl border border-slate-800 overflow-hidden text-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 uppercase tracking-wider text-xs">
                <th className="px-4 py-4 text-left font-semibold">Proveedor</th>
                <th className="px-4 py-4 text-left font-semibold">Correo</th>
                <th className="px-4 py-4 text-center font-semibold">Perfiles</th>
                <th className="px-4 py-4 text-right font-semibold">Costo</th>
                <th className="px-4 py-4 text-center font-semibold">Estado</th>
                <th className="px-4 py-4 text-center font-semibold">IMAP</th>
                <th className="px-4 py-4 text-center font-semibold">Días Restantes</th>
                <th className="px-4 py-4 text-center font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cuentasFiltradas.length > 0 ? (
                cuentasPaginadas.map((c: Cuenta) => {
                  const badge = ESTADO_BADGES[c.estado] || { label: c.estado, class: 'bg-slate-800 text-slate-300' };
                  const perfiles = Array.isArray(c.perfiles) ? c.perfiles : [];
                  const perfilesDisp = perfiles.filter(p => p.estado === 'disponible').length;
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <span className="font-semibold text-white">{c.proveedor}</span>
                        {c.nombreProveedor && (
                          <div className="text-xs text-indigo-400 font-medium">Mayorista: {c.nombreProveedor}</div>
                        )}
                        <div className="text-xs text-slate-400 mt-0.5">{c.tipoVenta === 'completa' ? 'Completa' : 'Por perfiles'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-slate-300 text-sm font-mono" title={c.correoCuenta}>
                          {maskEmail(c.correoCuenta)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-slate-200 font-medium">
                          {c.tipoVenta === 'completa' ? (
                            '—'
                          ) : (
                            <>{perfilesDisp} / {perfiles.length}</>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-semibold text-white">
                          {formatear(c.costo)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                          c.estado === 'disponible'
                            ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40'
                            : c.estado === 'asignada'
                              ? 'bg-indigo-950/50 text-indigo-300 border border-indigo-800/40'
                              : 'bg-rose-950/50 text-rose-400 border border-rose-800/40'
                        }`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                          c.imapConfigurado
                            ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40'
                            : 'bg-slate-800 text-slate-500 border border-slate-700'
                        }`}>
                          IMAP
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {c.fechaVencimiento ? (
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                              c.diasRestantes !== null && c.diasRestantes! > 7
                                ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40'
                                : c.diasRestantes !== null && c.diasRestantes! > 0
                                  ? 'bg-amber-950/50 text-amber-400 border-amber-800/40'
                                  : 'bg-rose-950/50 text-rose-400 border-rose-800/40'
                            }`}
                          >
                            {c.diasRestantes !== null && c.diasRestantes! > 0
                              ? `${c.diasRestantes} días`
                              : 'Vencido'}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <DropdownMenu
                          actions={[
                            {
                              label: 'Ver cuenta',
                              icon: <Eye size={16} />,
                              onClick: () => {
                                setCuentaSeleccionada(c);
                                setMostrarVer(true);
                              },
                            },
                            {
                              label: 'Editar cuenta',
                              icon: <Edit size={16} />,
                              onClick: () => {
                                setCuentaSeleccionada(c);
                                setMostrarEditar(true);
                              },
                            },
                            {
                              label: 'Renovar cuenta',
                              icon: <RefreshCw size={16} />,
                              onClick: () => handleRenovarCuenta(c),
                            },
                            ...(perfilesDisp > 0 ? [{
                              label: 'Asignar perfil',
                              icon: <Link size={16} />,
                              onClick: () => {
                                const perfilesArr = Array.isArray(c.perfiles) ? c.perfiles : [];
                                const idxPrimerDisp = perfilesArr.findIndex(p => p.estado === 'disponible');
                                setCuentaAsignando(c);
                                setPerfilIdxAsignando(Math.max(0, idxPrimerDisp));
                                setBusquedaCliente('');
                                setMostrarAsignar(true);
                              },
                            }] : []),
                            {
                              label: c.imapConfigurado ? 'Ver IMAP' : 'Configurar IMAP',
                              icon: <Key size={16} />,
                              onClick: () => {
                                setCuentaSeleccionada(c);
                                setMostrarIMAP(true);
                              },
                            },
                            {
                              label: 'Generar ticket',
                              icon: <Ticket size={16} />,
                              onClick: () => handleGenerarTicket(c),
                            },
                            {
                              label: c.estado === 'expirada' ? 'Reactivar cuenta' : 'Desactivar cuenta',
                              icon: c.estado === 'expirada' ? <Eye size={16} /> : <EyeOff size={16} />,
                              onClick: () => handleToggleEstado(c),
                              variant: c.estado === 'expirada' ? 'default' : 'danger',
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    <Film size={48} className="mx-auto mb-3 text-slate-700" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Registrar Cuenta</h2>
                <p className="text-slate-400 mt-1">Agregá una nueva cuenta de streaming</p>
              </div>
              <button
                onClick={() => setMostrarRegistrar(false)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={24} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">{cuentaSeleccionada.proveedor}</h2>
                <p className="text-slate-400 mt-1">Detalle de la cuenta</p>
              </div>
              <button
                onClick={() => {
                  setMostrarVer(false);
                  setCuentaSeleccionada(null);
                }}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <CuentaDetail cuenta={cuentaSeleccionada} />
          </div>
        </div>
      )}

      {/* Modal: Editar Cuenta */}
      {mostrarEditar && cuentaSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Editar Cuenta</h2>
                <p className="text-slate-400 mt-1">{cuentaSeleccionada.proveedor} — {maskEmail(cuentaSeleccionada.correoCuenta)}</p>
              </div>
              <button
                onClick={() => {
                  setMostrarEditar(false);
                  setCuentaSeleccionada(null);
                }}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <CuentaForm
              key={cuentaSeleccionada.id}
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

      {/* Modal: Configurar IMAP */}
      {mostrarIMAP && cuentaSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Credenciales IMAP</h2>
                <p className="text-slate-400 mt-1">{cuentaSeleccionada.proveedor}</p>
              </div>
              <button
                onClick={() => {
                  setMostrarIMAP(false);
                  setCuentaSeleccionada(null);
                }}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <ConfigurarIMAP
              cuenta={cuentaSeleccionada}
              onClose={() => {
                setMostrarIMAP(false);
                setCuentaSeleccionada(null);
              }}
              onSuccess={async () => {
                try {
                  await updateDoc(doc(db, 'cuentas', cuentaSeleccionada.id), {
                    imapConfigurado: true,
                    updatedAt: serverTimestamp(),
                  });
                } catch (err) {
                  console.warn('No se pudo marcar imapConfigurado:', err);
                }
                toast.success('Credenciales IMAP guardadas ✓');
              }}
            />
          </div>
        </div>
      )}

      {/* Modal: Ticket de la cuenta */}
      {mostrarDatosCuenta && datosCuenta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center">
                  <Ticket size={20} className="text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Ticket de la Cuenta</h2>
                  <p className="text-sm text-slate-400">{datosCuenta.proveedor}</p>
                </div>
              </div>
              <button
                onClick={() => { setMostrarDatosCuenta(false); setDatosCuenta(null); setCuentaTicket(null); }}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800 space-y-3">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Correo</span>
                  <p className="text-sm font-medium text-slate-100 mt-0.5 select-all">{datosCuenta.correo || datosCuenta.correoCuenta}</p>
                </div>
                {datosCuenta.contrasena && (
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Contraseña</span>
                    <p className="text-sm font-medium text-amber-400 mt-0.5 select-all font-mono">{datosCuenta.contrasena}</p>
                  </div>
                )}
                {cuentaTicket?.fechaVencimiento && (
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Vencimiento</span>
                    <p className="text-sm font-medium text-slate-100 mt-0.5">
                      {cuentaTicket.fechaVencimiento} {cuentaTicket.diasRestantes !== null && cuentaTicket.diasRestantes !== undefined ? `(${cuentaTicket.diasRestantes > 0 ? `${cuentaTicket.diasRestantes} días` : 'Vencido'})` : ''}
                    </p>
                  </div>
                )}
              </div>

              {datosCuenta.perfiles?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Perfiles</h3>
                  <div className="space-y-2">
                    {datosCuenta.perfiles.map((p, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-slate-200">{p.nombre}</p>
                          {p.pin && <p className="text-xs text-slate-400">PIN: {p.pin}</p>}
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                          p.estado === 'disponible' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40' : 'bg-amber-950/50 text-amber-400 border-amber-800/40'
                        }`}>
                          {p.estado === 'disponible' ? 'Disponible' : 'Asignado'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={copiarTicket}
                className="btn-primary w-full flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/50"
              >
                {copiadoTicket ? <Check size={18} /> : <Ticket size={18} />}
                {copiadoTicket ? '¡Ticket copiado!' : 'Copiar ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Asignar Perfil a Cliente */}
      {mostrarAsignar && cuentaAsignando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Asignar Perfil</h2>
                <p className="text-slate-400 mt-1">{cuentaAsignando.proveedor} — {maskEmail(cuentaAsignando.correoCuenta)}</p>
              </div>
              <button
                onClick={() => {
                  setMostrarAsignar(false);
                  setCuentaAsignando(null);
                }}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Selector de perfil */}
              {(() => {
                const perfilesAsignando = Array.isArray(cuentaAsignando.perfiles) ? cuentaAsignando.perfiles : [];
                const disponibles = perfilesAsignando.filter(p => p.estado === 'disponible');
                return (
                  <>
                    {disponibles.length > 1 && (
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Seleccionar perfil</label>
                        <select
                          value={perfilIdxAsignando}
                          onChange={(e) => setPerfilIdxAsignando(Number(e.target.value))}
                          className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100"
                        >
                          {perfilesAsignando.map((p, idx) =>
                            p.estado === 'disponible' ? (
                              <option key={idx} value={idx}>
                                {p.nombre}{p.pin ? ` (PIN: ${p.pin})` : ''}
                              </option>
                            ) : null
                          )}
                        </select>
                      </div>
                    )}

                    {disponibles.length === 1 && (
                      <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-800/40">
                        <p className="text-sm font-semibold text-indigo-300">
                          Perfil: {disponibles[0].nombre}
                        </p>
                      </div>
                    )}
                    {disponibles.length === 0 && (
                      <p className="text-sm text-slate-500 italic">No hay perfiles disponibles</p>
                    )}
                  </>
                );
              })()}

              {/* Buscador de clientes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Buscar cliente</label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
                  <input
                    type="text"
                    value={busquedaCliente}
                    onChange={(e) => setBusquedaCliente(e.target.value)}
                    placeholder="Escribí el nombre del cliente..."
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 placeholder:text-slate-500/70 placeholder:font-normal caret-cyan-400 transition-all duration-150"
                    autoFocus
                  />
                </div>
              </div>

              {/* Lista de clientes */}
              <div className="max-h-60 overflow-y-auto space-y-1">
                {loadingClientes ? (
                  <div className="space-y-3 py-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-12 bg-slate-800 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : todosLosClientes.length === 0 ? (
                  <p className="text-sm text-slate-500 italic text-center py-8">
                    No hay clientes registrados
                  </p>
                ) : (
                  todosLosClientes
                    .filter(c => !busquedaCliente || c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase()))
                    .slice(0, 50)
                    .map((cliente) => (
                      <button
                        key={cliente.id}
                        onClick={() => handleAsignarPerfil(cliente.nombre)}
                        disabled={guardando}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-950/40 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all text-left disabled:opacity-50"
                      >
                        <div className="w-8 h-8 rounded-full bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center flex-shrink-0">
                          <Users size={16} className="text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-200 truncate">{cliente.nombre}</p>
                          {cliente.telefono && (
                            <p className="text-xs text-slate-400">{cliente.telefono}</p>
                          )}
                        </div>
                        {guardando ? (
                          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Check size={18} className="text-indigo-400 flex-shrink-0" />
                        )}
                      </button>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Renovar Cuenta */}
      {mostrarRenovar && cuentaRenovar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Renovar Cuenta</h2>
              <button
                onClick={() => {
                  setMostrarRenovar(false);
                  setCuentaRenovar(null);
                }}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <p className="text-sm text-slate-300 mb-2">
              {cuentaRenovar.proveedor} — {maskEmail(cuentaRenovar.correoCuenta)}
            </p>
            <p className="text-xs text-slate-400 mb-6">
              Solo se actualizarán las fechas y el estado. Los perfiles asignados no se modifican.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Fecha de inicio</label>
                <input
                  type="date"
                  value={renovarFechaInicio}
                  onChange={(e) => setRenovarFechaInicio(e.target.value)}
                  className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 transition-all duration-150"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Días de servicio</label>
                <input
                  type="number"
                  value={renovarDiasServicio}
                  onChange={(e) => setRenovarDiasServicio(e.target.value)}
                  className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 placeholder:text-slate-500/70 placeholder:font-normal caret-cyan-400 transition-all duration-150"
                  min="1"
                  placeholder="Ej: 30"
                  required
                />
              </div>
              {renovarFechaInicio && renovarDiasServicio && Number(renovarDiasServicio) > 0 && (
                <div className="flex items-center justify-between px-3 py-2 bg-indigo-950/40 rounded-xl border border-indigo-800/40">
                  <span className="text-sm font-medium text-indigo-300">Nuevo vencimiento</span>
                  <span className="text-sm font-bold text-cyan-300">
                    {(() => {
                      const d = new Date(renovarFechaInicio);
                      d.setDate(d.getDate() + Number(renovarDiasServicio));
                      return d.toISOString().split('T')[0];
                    })()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-6">
              <button
                onClick={() => {
                  setMostrarRenovar(false);
                  setCuentaRenovar(null);
                }}
                className="btn-secondary flex-1"
                disabled={renovando}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarRenovarCuenta}
                disabled={renovando || !renovarFechaInicio || !renovarDiasServicio}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {renovando ? 'Renovando...' : 'Renovar cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar acción */}
      {confirmarAccion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in text-center text-slate-100">
            <div className="w-16 h-16 rounded-full bg-rose-950/60 border border-rose-800/50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-rose-400" size={32} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              {confirmarAccion.accion === 'desactivar' ? 'Desactivar cuenta' : 'Reactivar cuenta'}
            </h2>
            <p className="text-slate-300 mb-6">
              {confirmarAccion.accion === 'desactivar'
                ? `¿Estás seguro de desactivar la cuenta de ${confirmarAccion.cuenta.proveedor}? Los perfiles asignados dejarán de funcionar.`
                : `¿Estás seguro de reactivar la cuenta de ${confirmarAccion.cuenta.proveedor}?`
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmarAccion(null)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarToggleEstado}
                disabled={togglendoEstado}
                className={`flex-1 py-2.5 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  confirmarAccion.accion === 'desactivar'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950/50'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950/50'
                }`}
              >
                {togglendoEstado ? 'Procesando...' : (confirmarAccion.accion === 'desactivar' ? 'Sí, desactivar' : 'Sí, reactivar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
