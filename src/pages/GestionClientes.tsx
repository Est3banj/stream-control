import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, increment, addDoc, serverTimestamp, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import { callFunction } from '../lib/apiClient';
import { useAuth } from '../contexts/AuthContext';
import useClientes from '../hooks/useClientes';
import useTokens, { generarToken, revocarToken } from '../hooks/useTokens';
import usePermisos from '../hooks/usePermisos';
import { useUpgradeModal } from '../contexts/UpgradeModalContext';
import useCuentas from '../hooks/useCuentas';
import { useMoneda } from '../hooks/useMoneda';
import Paginador from '../components/Paginador';
import ConsultaInterna from '../components/ConsultaInterna';
import DropdownMenu from '../components/DropdownMenu';
import TicketModal from '../components/TicketModal';
import PlataformaBadge from '../components/PlataformaBadge';
import LoadingScreen from '../components/LoadingScreen';
import toast from 'react-hot-toast';
import { Search, Download, MessageCircle, Calendar, Users, TrendingUp, X, AlertCircle, Edit, Mail, DollarSign, CheckCircle, UserCheck, AlertTriangle, RefreshCw, Sparkles, Link, Key, Copy, ExternalLink, Shield, LogOut } from 'lucide-react';
import type { Venta } from '../types/venta';
import type { Cliente } from '../types/cliente';

export default function GestionClientes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { clientes: todosLosClientes, loading, error } = useClientes(user);
  const permisos = usePermisos(user);
  const { show: showUpgradeModal } = useUpgradeModal();
  const { tokens: todosLosTokens } = useTokens(user);
  const { cuentas } = useCuentas(user);
  const { formatear, formatearDesdeVenta } = useMoneda();
  const [clientes, setClientes] = useState<{ activos: Cliente[]; inactivos: Cliente[]; todos: Cliente[] }>({ activos: [], inactivos: [], todos: [] });
  const [filtro, setFiltro] = useState<'activos' | 'inactivos' | 'todos'>('activos');
  const [busqueda, setBusqueda] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [historialVentas, setHistorialVentas] = useState<Venta[]>([]);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [mostrarEditar, setMostrarEditar] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [formEditar, setFormEditar] = useState<{ nombre: string; telefono: string; correo: string; plataforma: string }>({
    nombre: '',
    telefono: '',
    correo: '',
    plataforma: '',
  });
  const [mostrarCobrar, setMostrarCobrar] = useState(false);
  const [clienteCobrar, setClienteCobrar] = useState<Cliente | null>(null);
  const [montoPago, setMontoPago] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const [itemsPorPagina, setItemsPorPagina] = useState(10);
  const historialUnsubscribeRef = useRef<(() => void) | null>(null);
  const [mostrarTokenModal, setMostrarTokenModal] = useState(false);
  const [tokenGeneradoURL, setTokenGeneradoURL] = useState('');
  const [tokenGenerando, setTokenGenerando] = useState(false);
  const [mostrarConsultaCodigo, setMostrarConsultaCodigo] = useState(false);
  const [consultaData, setConsultaData] = useState<{ clienteNombre: string; proveedor: string; correoCuenta: string; tokenId: string } | null>(null);
  const [confirmarRevocar, setConfirmarRevocar] = useState<{ tokenId: string; clienteNombre: string } | null>(null);
  const [revocando, setRevocando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmarLiberar, setConfirmarLiberar] = useState<Cliente | null>(null);
  const [mostrarTicket, setMostrarTicket] = useState(false);
  const [clienteTicket, setClienteTicket] = useState<Cliente | null>(null);
  const [liberando, setLiberando] = useState(false);

  // Clasificar clientes cuando cambian los datos (incluye array vacío)
  useEffect(() => {
    if (loading) return;
    const activos = todosLosClientes.filter(c => c.diasRestantes! > 0);
    const inactivos = todosLosClientes.filter(c => c.diasRestantes! <= 0);
    setClientes({ activos, inactivos, todos: todosLosClientes });
  }, [todosLosClientes, loading]);

  // Resetear página al cambiar filtros o búsqueda
  useEffect(() => {
    setPaginaActual(1);
  }, [filtro, busqueda]);

  // Limpiar listener de historial al desmontar el componente
  useEffect(() => {
    return () => {
      if (historialUnsubscribeRef.current) {
        historialUnsubscribeRef.current();
        historialUnsubscribeRef.current = null;
      }
    };
  }, []);

  // 🔍 Cargar historial de ventas de un cliente
  const cargarHistorial = async (clienteNombre: string): Promise<void> => {
    if (!user) return;

    // Limpiar listener anterior si existe
    if (historialUnsubscribeRef.current) {
      historialUnsubscribeRef.current();
      historialUnsubscribeRef.current = null;
    }

    try {
      let q = query(collection(db, 'ventas'), where('nombre', '==', clienteNombre));
      if (user.rol !== 'admin') {
        q = query(q, where('propietarioId', '==', user.uid));
      }

      historialUnsubscribeRef.current = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
        const ventas = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Venta)).sort((a, b) => {
          const fechaA = a.fechaRegistro?.seconds || 0;
          const fechaB = b.fechaRegistro?.seconds || 0;
          return fechaB - fechaA;
        });
        setHistorialVentas(ventas);
      });

      // No devolvemos nada, el ref se encarga del cleanup

    } catch (error: unknown) {
      console.error('Error cargando historial:', error);
      toast.error('Error al cargar historial de ventas');
    }
  };

  // ✏️ Abrir modal de edición
  const abrirEditar = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setFormEditar({
      nombre: cliente.nombre || '',
      telefono: cliente.telefono || '',
      correo: cliente.correo || '',
      plataforma: cliente.plataforma || '',
    });
    setMostrarEditar(true);
  };

  // 💾 Guardar cambios del cliente
  const guardarEdicion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validaciones
    if (!formEditar.nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (!formEditar.telefono.trim()) {
      toast.error('El teléfono o usuario es obligatorio');
      return;
    }
    const tel = formEditar.telefono.trim();
    const telefonoValido = tel.startsWith('@') ? tel.length > 1 : /^\+[1-9]\d{6,14}$/.test(tel);
    if (!telefonoValido) {
      toast.error('Ingresá un número con código de país (+57...) o un usuario de WhatsApp (@usuario)');
      return;
    }
    if (formEditar.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEditar.correo.trim())) {
      toast.error('El correo electrónico no es válido');
      return;
    }
    if (!formEditar.plataforma.trim()) {
      toast.error('La plataforma es obligatoria');
      return;
    }

    setGuardando(true);
    try {
      const clienteRef = doc(db, 'clientes', clienteEditando!.id);
      await updateDoc(clienteRef, {
        nombre: formEditar.nombre.trim(),
        telefono: formEditar.telefono.trim(),
        correo: formEditar.correo.trim(),
        plataforma: formEditar.plataforma.trim(),
      });

      toast.success('Cliente actualizado correctamente');
      setMostrarEditar(false);
      setClienteEditando(null);
    } catch (error: unknown) {
      console.error('Error actualizando cliente:', error);
      toast.error('Error al actualizar el cliente');
      setMostrarEditar(false);
    } finally {
      setGuardando(false);
    }
  };

  // 📱 Enviar WhatsApp
  const enviarWhatsApp = (cliente: Cliente) => {
    if (!cliente.telefono || !cliente.telefono.trim()) {
      toast.error('El cliente no tiene un número de teléfono registrado');
      return;
    }
    const tel = cliente.telefono.trim();
    const dias = Math.abs(cliente.diasRestantes ?? 0);
    const mensaje = (cliente.diasRestantes ?? 0) > 0
      ? `Hola ${cliente.nombre}, tu servicio de ${cliente.plataforma || 'streaming'} vence en ${dias} día(s). Te invitamos a renovarlo para seguir disfrutando sin interrupciones.`
      : `Hola ${cliente.nombre}, te informamos que tu servicio de ${cliente.plataforma || 'streaming'} finalizó hace ${dias} días. Para seguir accediendo a tus series y películas favoritas sin interrupciones, podés renovar tu plan. Si no deseas continuar, no es necesario que hagas nada. ¡Gracias por confiar en nosotros!`;

    // Usuario de WhatsApp (@...): los enlaces wa.me no lo soportan, copiar al portapapeles
    if (tel.startsWith('@')) {
      navigator.clipboard.writeText(tel);
      toast.success(`Usuario ${tel} copiado — buscálo en WhatsApp`, { duration: 4000 });
      return;
    }

    const numLimpio = tel.replace(/[^0-9+]/g, '');
    const numParaUrl = numLimpio.startsWith('+') ? numLimpio.replace(/[^0-9]/g, '') : `57${numLimpio}`;
    const url = `https://wa.me/${numParaUrl}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  // 🔍 Filtrado por búsqueda + ordenado por fecha de vencimiento
  const clientesFiltrados: Cliente[] = (clientes[filtro]?.filter(
    (c: Cliente) =>
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.plataforma && c.plataforma.toLowerCase().includes(busqueda.toLowerCase())) ||
      (c.correo && c.correo.toLowerCase().includes(busqueda.toLowerCase())) ||
      (c.telefono && c.telefono.includes(busqueda))
  ) || []).sort((a, b) => {
    const aDias = a.diasRestantes ?? 0;
    const bDias = b.diasRestantes ?? 0;

    // Vencidos: más recientes primero (fecha descendente)
    if (aDias <= 0 && bDias <= 0) {
      return b.fechaVencimiento.localeCompare(a.fechaVencimiento);
    }
    // Activos: próximo a vencer primero (fecha ascendente)
    if (aDias > 0 && bDias > 0) {
      return a.fechaVencimiento.localeCompare(b.fechaVencimiento);
    }
    // Mixto: vencidos primero
    return aDias <= 0 ? -1 : 1;
  });

  const indexUltimo = paginaActual * itemsPorPagina;
  const indexPrimero = indexUltimo - itemsPorPagina;
  const clientesPaginados = clientesFiltrados.slice(indexPrimero, indexUltimo);

  // 📤 Exportar datos a CSV
  const exportarCSV = () => {
    if (!clientesFiltrados.length) {
      toast.error('No hay clientes para exportar');
      return;
    }

    const encabezados = ['Nombre', 'Teléfono', 'Correo', 'Plataforma', 'Fecha de Vencimiento', 'Días Restantes', 'Estado', 'Estado Pago'];
    const filas = clientesFiltrados.map((c: Cliente) => [
      c.nombre,
      c.telefono,
      c.correo || '-',
      c.plataforma || '-',
      c.fechaVencimiento || '-',
      c.diasRestantes || 0,
      c.diasRestantes! > 0 ? 'Activo' : 'Inactivo',
      c.saldoPendiente > 0 ? `Debe $${c.saldoPendiente}` : 'Al día',
    ]);

    const csvContent = [encabezados, ...filas].map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `clientes_${filtro}_${new Date().toISOString().split('T')[0]}.csv`;
    enlace.click();
    toast.success('CSV exportado correctamente');
  };

  // 💰 Registrar pago
  const registrarPago = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !clienteCobrar) return;

    const monto = Number(montoPago);
    if (!monto || monto <= 0) return toast.error('El monto debe ser mayor a 0');
    if (monto > clienteCobrar.saldoPendiente)
      return toast.error('El pago no puede superar el saldo pendiente');

    setGuardando(true);
    try {
      // Reducir saldo pendiente del cliente
      await updateDoc(doc(db, 'clientes', clienteCobrar.id), {
        saldoPendiente: increment(-monto),
      });

      // Registrar movimiento
      await addDoc(collection(db, 'movimientos'), {
        tipo: 'Ingreso',
        monto,
        descripcion: `Pago recibido de ${clienteCobrar.nombre}`,
        fecha: serverTimestamp(),
        propietarioId: user.uid,
        usuarioEmail: user.email,
      });

      toast.success(`Pago de ${formatear(monto)} registrado correctamente`);
      setMostrarCobrar(false);
      setClienteCobrar(null);
      setMontoPago('');
    } catch (error: unknown) {
      console.error('Error registrando pago:', error);
      toast.error('Error al registrar el pago');
    } finally {
      setGuardando(false);
    }
  };

  const generarLinkCodigos = async (cliente: Cliente) => {
    if (!user || !cliente.cuentaId) return;
    if (!permisos.puedeGenerarTokens) {
      toast.error('La generación de links de códigos es exclusiva del plan Enterprise. Actualizá tu plan.');
      showUpgradeModal();
      return;
    }
    setTokenGenerando(true);
    try {
      const linkData = {
        cuentaId: cliente.cuentaId,
        perfilNombre: cliente.perfilAsignado || '',
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        expiraEn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const docId = await generarToken(linkData);
      const url = `${window.location.origin}/r/${docId}`;
      setTokenGeneradoURL(url);
      setMostrarTokenModal(true);
    } catch (err) {
      console.error('Error generando token:', err);
      const message = err instanceof Error ? err.message : 'Error al generar el link de códigos';
      toast.error(message);
    } finally {
      setTokenGenerando(false);
    }
  };

  const copiarTokenURL = () => {
    navigator.clipboard.writeText(tokenGeneradoURL);
    toast.success('Link copiado al portapapeles');
  };

  const handleRevocarToken = async () => {
    if (!confirmarRevocar) return;
    setRevocando(true);
    try {
      await revocarToken(confirmarRevocar.tokenId);
      toast.success('Token revocado correctamente');
      setConfirmarRevocar(null);
    } catch (err) {
      console.error('Error revocando token:', err);
      toast.error('Error al revocar el token');
    } finally {
      setRevocando(false);
    }
  };

  const abrirConsultaCodigo = (cliente: Cliente) => {
    if (!permisos.puedeGenerarTokens) {
      toast.error('La consulta de códigos de verificación es exclusiva del plan Enterprise. Actualizá tu plan.');
      showUpgradeModal();
      return;
    }
    const tokenCliente = todosLosTokens.find(
      t => t.clienteId === cliente.id && t.activo
    );
    if (!tokenCliente) {
      toast.error('Este cliente no tiene un token activo. Generá un link primero.');
      return;
    }
    const cuenta = cuentas.find(c => c.id === tokenCliente.cuentaId);
    if (!cuenta) {
      toast.error('No se encontró la cuenta asociada');
      return;
    }
    setConsultaData({
      clienteNombre: cliente.nombre,
      proveedor: cuenta.proveedor,
      correoCuenta: cuenta.correoCuenta,
      tokenId: tokenCliente.id,
    });
    setMostrarConsultaCodigo(true);
  };

  const confirmarLiberarPerfil = (cliente: Cliente) => {
    setConfirmarLiberar(cliente);
  };

  const handleLiberarPerfil = async () => {
    if (!confirmarLiberar) return;
    setLiberando(true);
    try {
      const data = await callFunction<object, { success: boolean }>('desasignarPerfil', {
        clienteId: confirmarLiberar.id,
        cuentaId: confirmarLiberar.cuentaId,
        perfilNombre: confirmarLiberar.perfilAsignado,
      });
      if (data.success) {
        toast.success(`Perfil de ${confirmarLiberar.nombre} liberado correctamente`);
        setConfirmarLiberar(null);
        // Los clientes se actualizan solos via onSnapshot
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al liberar el perfil';
      console.error('Error liberando perfil:', err);
      toast.error(`${msg}`);
    } finally {
      setLiberando(false);
    }
  };

  const abrirHistorial = (cliente: Cliente) => {
    setClienteSeleccionado(cliente);
    setMostrarHistorial(true);
    cargarHistorial(cliente.nombre);
  };

  if (loading) {
    return <LoadingScreen mensaje="Cargando clientes..." />;
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
      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
          {user?.rol === 'admin' ? 'Gestión de Clientes — Plataforma' : 'Gestión de Clientes'}
        </h1>
        <p className="text-slate-400">Administra y contacta a tus clientes</p>
      </div>

      {/* Controles */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl p-6 text-slate-100">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            {(['activos', 'inactivos', 'todos'] as const).map((tipo) => (
              <button
                key={tipo}
                onClick={() => setFiltro(tipo)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filtro === tipo
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/50'
                    : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
              </button>
            ))}
          </div>

          {/* Búsqueda */}
          <div className="flex-1 relative max-w-md w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
            <input
              type="text"
              placeholder="Buscar cliente, plataforma o teléfono..."
              value={busqueda}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusqueda(e.target.value)}
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

      {/* Resumen agregado para admin */}
      {user?.rol === 'admin' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card cursor-default">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-950/50">
                <Users className="text-white" size={24} />
              </div>
              <Users className="text-indigo-400" size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Clientes</p>
              <p className="text-2xl font-bold text-white">{clientes.todos.length.toLocaleString()}</p>
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
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Clientes Activos</p>
              <p className="text-2xl font-bold text-white">{clientes.activos.length.toLocaleString()}</p>
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
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Clientes Vencidos</p>
              <p className="text-2xl font-bold text-white">{clientes.inactivos.length.toLocaleString()}</p>
            </div>
          </div>
          <div className="card cursor-default">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-950/50">
                <UserCheck className="text-white" size={24} />
              </div>
              <UserCheck className="text-indigo-400" size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Vendedores</p>
              <p className="text-2xl font-bold text-white">
                {new Set(clientes.todos.map(c => c.propietarioId).filter(Boolean)).size.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Banner de límite para Starter */}
      {user?.rol !== 'admin' && permisos.planNombre === 'Starter' && (
        <div className="bg-gradient-to-r from-amber-950/40 to-orange-950/40 border border-amber-800/50 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sparkles className="text-amber-400 shrink-0" size={20} />
            <div>
              <p className="text-sm font-medium text-amber-300">
                Plan Starter — <strong>{clientes.todos.length}</strong> de {permisos.clienteLimit} clientes usados
              </p>
              <p className="text-xs text-amber-400/80 mt-0.5">
                Actualizá a Professional para clientes ilimitados y alertas automáticas por Telegram.
              </p>
            </div>
          </div>
          <button
            onClick={() => showUpgradeModal()}
            className="btn-primary text-xs py-2 px-4 whitespace-nowrap"
          >
            Actualizar a Pro
          </button>
        </div>
      )}

      {/* Lista de clientes */}
      <div className="bg-slate-900/80 rounded-2xl shadow-xl border border-slate-800 overflow-hidden text-slate-100">
        {user?.rol === 'admin' && (
          <div className="px-6 pt-4 pb-2 border-b border-slate-800">
            <p className="text-sm text-slate-400 italic">Vista general de todos los vendedores de la plataforma</p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 uppercase tracking-wider text-xs">
                <th className="px-4 py-4 text-left font-semibold">Cliente</th>
                {user?.rol === 'admin' && (
                  <th className="px-4 py-4 text-left font-semibold">Vendedor</th>
                )}
                <th className="px-4 py-4 text-left font-semibold">Contacto</th>
                <th className="px-4 py-4 text-left font-semibold">Plataforma</th>
                <th className="px-4 py-4 text-left font-semibold">Cuenta</th>
                <th className="px-4 py-4 text-left font-semibold">Vencimiento</th>
                <th className="px-4 py-4 text-center font-semibold">Días Restantes</th>
                <th className="px-4 py-4 text-center font-semibold">Estado Pago</th>
                <th className="px-4 py-4 text-center font-semibold">Token</th>
                <th className="px-4 py-4 text-center font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.length > 0 ? (
                clientesPaginados.map((c: Cliente) => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold text-white">{c.nombre}</div>
                        {(c.esMayorista === true || (Boolean(c.pantallas) && (c.pantallas as number) > 1)) && (
                          <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-950/60 border border-amber-800/50 text-amber-300">
                            Mayorista ({c.pantallas || 1} pantallas)
                          </span>
                        )}
                      </div>
                      {c.correo && (
                        <div className="text-xs text-slate-400 mt-1">{c.correo}</div>
                      )}
                    </td>
                    {user?.rol === 'admin' && (
                      <td className="px-4 py-4">
                        <div className="text-slate-300">{c.usuarioEmail || '—'}</div>
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div className="text-slate-300">{c.telefono}</div>
                    </td>
                    <td className="px-4 py-4">
                      <PlataformaBadge plataforma={c.plataforma} />
                    </td>
                    <td className="px-4 py-4">
                      {c.cuentaId ? (
                        <div className="text-sm text-slate-200">
                          <div className="font-medium text-indigo-400">{c.perfilAsignado || '—'}</div>
                          <div className="text-xs text-slate-500 mt-0.5">Cuenta asignada</div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Calendar size={16} className="text-slate-400" />
                        {c.fechaVencimiento
                          ? new Date(c.fechaVencimiento).toLocaleDateString('es-CO')
                          : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${c.diasRestantes! > 7
                            ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40'
                            : c.diasRestantes! > 0
                              ? 'bg-amber-950/50 text-amber-400 border-amber-800/40'
                              : 'bg-rose-950/50 text-rose-400 border-rose-800/40'
                          }`}
                      >
                        {c.diasRestantes! > 0 ? `${c.diasRestantes} días` : 'Vencido'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {c.saldoPendiente > 0 ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-950/50 text-rose-400 border border-rose-800/40 text-xs font-semibold">
                          <AlertCircle size={14} />
                          Debe ${formatear(c.saldoPendiente)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-800/40 text-xs font-semibold">
                          Al día
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {(() => {
                        const tokenCliente = todosLosTokens.find(
                          t => t.clienteId === c.id && t.activo
                        );
                        if (!tokenCliente) {
                          return <span className="text-sm text-slate-500">—</span>;
                        }
                        const expirado = new Date(tokenCliente.expiraEn) < new Date();
                        if (expirado) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-xs font-medium">
                              Expirado
                            </span>
                          );
                        }
                        return (
                          <div className="flex items-center justify-center gap-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-950/50 text-cyan-400 border border-cyan-800/40 text-xs font-medium">
                              <Key size={12} />
                              Vigente
                            </span>
                            <button
                              onClick={() => setConfirmarRevocar({ tokenId: tokenCliente.id, clienteNombre: c.nombre })}
                              className="p-1 rounded-xl bg-rose-950/60 text-rose-400 hover:bg-rose-900 border border-rose-800/50 transition-colors"
                              title="Revocar token"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative">
                        <DropdownMenu
                          actions={[
                            {
                              label: 'Editar cliente',
                              icon: <Edit size={16} />,
                              onClick: () => abrirEditar(c),
                            },
                            {
                              label: 'Ver historial',
                              icon: <TrendingUp size={16} />,
                              onClick: () => abrirHistorial(c),
                            },
                            ...(c.saldoPendiente > 0 ? [{
                              label: 'Registrar pago',
                              icon: <DollarSign size={16} />,
                              onClick: () => {
                                setClienteCobrar(c);
                                setMontoPago(String(c.saldoPendiente));
                                setMostrarCobrar(true);
                              },
                            }] : []),
                            {
                              label: 'Renovar',
                              icon: <RefreshCw size={16} />,
                              onClick: () => navigate('/ventas', { state: { cliente: c } }),
                            },
                            {
                              label: 'Generar ticket',
                              icon: <Copy size={16} />,
                              onClick: () => {
                                setClienteTicket(c);
                                setMostrarTicket(true);
                              },
                            },
                            ...(c.cuentaId && permisos.puedeGenerarTokens ? [{
                              label: 'Consultar código',
                              icon: <Shield size={16} />,
                              onClick: () => abrirConsultaCodigo(c),
                            }] : []),
                            ...(c.cuentaId && permisos.puedeGenerarTokens ? [{
                              label: 'Generar link',
                              icon: <Link size={16} />,
                              onClick: () => generarLinkCodigos(c),
                              disabled: tokenGenerando,
                            }] : []),
                            ...(c.cuentaId ? [{
                              label: 'Liberar perfil',
                              icon: <LogOut size={16} />,
                              onClick: () => confirmarLiberarPerfil(c),
                            }] : []),
                            {
                              label: 'WhatsApp',
                              icon: <MessageCircle size={16} />,
                              onClick: () => enviarWhatsApp(c),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={user?.rol === 'admin' ? 10 : 9} className="text-center py-12 text-slate-500">
                    <Users size={48} className="mx-auto mb-3 text-slate-700" />
                    <p className="font-medium">No se encontraron clientes {filtro}</p>
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
        totalItems={clientesFiltrados.length}
        itemsPerPage={itemsPorPagina}
        onPageChange={setPaginaActual}
        onItemsPerPageChange={(val: number) => {
          setItemsPorPagina(val);
          setPaginaActual(1);
        }}
      />

      {/* Modal de edición */}
      {mostrarEditar && clienteEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Editar Cliente</h2>
                <p className="text-slate-400 mt-1">Actualiza la información del cliente</p>
              </div>
              <button
                onClick={() => {
                  setMostrarEditar(false);
                  setClienteEditando(null);
                }}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={guardarEdicion} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nombre del cliente <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formEditar.nombre}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormEditar({ ...formEditar, nombre: e.target.value })}
                  className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 placeholder:text-slate-500/70 placeholder:font-normal caret-cyan-400 transition-all duration-150"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Teléfono o usuario <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formEditar.telefono}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormEditar({ ...formEditar, telefono: e.target.value })}
                  placeholder="+573104567890 o @usuario"
                  className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 placeholder:text-slate-500/70 placeholder:font-normal caret-cyan-400 transition-all duration-150"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={formEditar.correo}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormEditar({ ...formEditar, correo: e.target.value })}
                  placeholder="cliente@ejemplo.com"
                  className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 placeholder:text-slate-500/70 placeholder:font-normal caret-cyan-400 transition-all duration-150"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Plataforma <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formEditar.plataforma}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormEditar({ ...formEditar, plataforma: e.target.value })}
                  className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 placeholder:text-slate-500/70 placeholder:font-normal caret-cyan-400 transition-all duration-150"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarEditar(false);
                    setClienteEditando(null);
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed">
                  {guardando ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de historial */}
      {mostrarHistorial && clienteSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Historial de Ventas</h2>
                <p className="text-slate-400 mt-1">{clienteSeleccionado.nombre}</p>
              </div>
              <button
                onClick={() => {
                  if (historialUnsubscribeRef.current) {
                    historialUnsubscribeRef.current();
                    historialUnsubscribeRef.current = null;
                  }
                  setMostrarHistorial(false);
                  setClienteSeleccionado(null);
                  setHistorialVentas([]);
                }}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {historialVentas.length > 0 ? (
              <div className="space-y-3">
                {historialVentas.map((venta: Venta) => (
                  <div
                    key={venta.id}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <div className="mb-1">
                          <PlataformaBadge plataforma={venta.plataforma} size="lg" />
                        </div>
                        {venta.correo && (
                          <div className="text-sm text-indigo-300 mt-1 flex items-center gap-1">
                            <Mail size={14} />
                            {venta.correo}
                          </div>
                        )}
                        <div className="text-sm text-slate-300 mt-1">
                          {venta.pantallas} pantalla(s) • {formatearDesdeVenta(venta.precioVenta * venta.pantallas, venta.monedaVenta, venta.tasaVenta)}
                        </div>
                        {venta.perfil && (
                          <div className="text-xs text-slate-400 mt-1">
                            Perfil: <span className="font-medium text-slate-200">{venta.perfil}</span>
                            {venta.pinPerfil && (
                              <> • PIN: <span className="font-medium text-slate-200">{venta.pinPerfil}</span></>
                            )}
                          </div>
                        )}
                        {venta.fechaRegistro?.seconds && (
                          <div className="text-xs text-slate-400 mt-1">
                            Fecha venta: {new Date(venta.fechaRegistro.seconds * 1000).toLocaleDateString('es-CO', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </div>
                        )}
                        {venta.fechaVencimiento && (
                          <div className="text-xs text-indigo-300 mt-1 font-medium flex items-center gap-1">
                            <Calendar size={12} />
                            Vence: {new Date(venta.fechaVencimiento).toLocaleDateString('es-CO', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-emerald-400">
                          Utilidad: {formatearDesdeVenta(venta.utilidad || 0, venta.monedaVenta, venta.tasaVenta)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <p>No hay ventas registradas para este cliente</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de link de códigos */}
      {mostrarTokenModal && permisos.puedeGenerarTokens && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Link de Códigos Generado</h2>
                <p className="text-slate-400 mt-1">Compartí este link con tu cliente</p>
              </div>
              <button
                onClick={() => {
                  setMostrarTokenModal(false);
                  setTokenGeneradoURL('');
                }}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800">
                <p className="text-sm font-medium text-cyan-300 mb-2">URL de consulta</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-slate-900 rounded-xl px-4 py-3 text-sm text-cyan-400 border border-slate-800 break-all font-mono">
                    {tokenGeneradoURL}
                  </code>
                  <button
                    onClick={copiarTokenURL}
                    className="p-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shrink-0 shadow-md shadow-indigo-950/50"
                    title="Copiar link"
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                El link expira en 30 días. El cliente puede consultar códigos de verificación desde esta URL.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarTokenModal(false);
                    setTokenGeneradoURL('');
                  }}
                  className="btn-secondary flex-1"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={copiarTokenURL}
                  className="btn-primary flex-1"
                >
                  <Copy size={16} className="inline mr-1" />
                  Copiar link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de consulta de código */}
      {mostrarConsultaCodigo && consultaData && permisos.puedeGenerarTokens && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 text-slate-100 animate-scale-in">
            <ConsultaInterna
              clienteNombre={consultaData.clienteNombre}
              proveedor={consultaData.proveedor}
              correoCuenta={consultaData.correoCuenta}
              tokenId={consultaData.tokenId}
              onClose={() => {
                setMostrarConsultaCodigo(false);
                setConsultaData(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Modal: Confirmar revocación de token */}
      {confirmarRevocar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in text-center text-slate-100">
            <div className="w-16 h-16 rounded-full bg-rose-950/60 border border-rose-800/50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-rose-400" size={32} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Revocar token</h2>
            <p className="text-slate-300 mb-6">
              ¿Estás seguro de revocar el token de <strong>{confirmarRevocar.clienteNombre}</strong>?
              El link de códigos dejará de funcionar inmediatamente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmarRevocar(null)}
                className="btn-secondary flex-1"
                disabled={revocando}
              >
                Cancelar
              </button>
              <button
                onClick={handleRevocarToken}
                disabled={revocando}
                className="flex-1 py-2.5 rounded-xl font-semibold text-white transition-all bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950/50 disabled:opacity-50"
              >
                {revocando ? 'Revocando...' : 'Sí, revocar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de cobro */}
      {mostrarCobrar && clienteCobrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Registrar Pago</h2>
                <p className="text-slate-400 mt-1">{clienteCobrar.nombre}</p>
              </div>
              <button
                onClick={() => {
                  setMostrarCobrar(false);
                  setClienteCobrar(null);
                  setMontoPago('');
                }}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={registrarPago} className="space-y-4">
              <div className="bg-amber-950/30 rounded-xl p-4 border border-amber-800/40">
                <p className="text-sm text-slate-300">
                  Saldo pendiente:{' '}
                  <span className="font-bold text-amber-300">
                    {formatear(clienteCobrar.saldoPendiente)}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Monto a cobrar <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm pointer-events-none">$</span>
                  <input
                    type="number"
                    value={montoPago}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMontoPago(e.target.value)}
                    className="w-full h-11 pl-8 pr-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 placeholder:text-slate-500/70 placeholder:font-normal caret-cyan-400 transition-all duration-150"
                    min="0.01"
                    max={clienteCobrar.saldoPendiente}
                    step="0.01"
                    required
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Máximo: {formatear(clienteCobrar.saldoPendiente)}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarCobrar(false);
                    setClienteCobrar(null);
                    setMontoPago('');
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {guardando ? 'Registrando...' : 'Cobrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar liberación de perfil */}
      {confirmarLiberar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in text-center text-slate-100">
            <div className="w-16 h-16 rounded-full bg-amber-950/60 border border-amber-800/50 flex items-center justify-center mx-auto mb-4">
              <LogOut className="text-amber-400" size={32} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Liberar perfil</h2>
            <p className="text-slate-300 mb-2">
              ¿Estás seguro de liberar el perfil <strong>{confirmarLiberar.perfilAsignado}</strong> de <strong>{confirmarLiberar.nombre}</strong>?
            </p>
            <p className="text-sm text-slate-400 mb-6">
              El perfil volverá a estar disponible para otros clientes. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmarLiberar(null)}
                className="btn-secondary flex-1"
                disabled={liberando}
              >
                Cancelar
              </button>
              <button
                onClick={handleLiberarPerfil}
                disabled={liberando}
                className="flex-1 py-2.5 rounded-xl font-semibold text-white transition-all bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-950/50 disabled:opacity-50"
              >
                {liberando ? 'Liberando...' : 'Sí, liberar perfil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarTicket && clienteTicket && (
        <TicketModal
          cliente={{
            nombre: clienteTicket.nombre,
            telefono: clienteTicket.telefono,
            id: clienteTicket.id,
          }}
          onClose={() => {
            setMostrarTicket(false);
            setClienteTicket(null);
          }}
        />
      )}
    </div>
  );
}
