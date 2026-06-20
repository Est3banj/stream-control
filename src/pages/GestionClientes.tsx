import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, increment, addDoc, serverTimestamp, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import useClientes from '../hooks/useClientes';
import usePermisos from '../hooks/usePermisos';
import Paginador from '../components/Paginador';
import toast from 'react-hot-toast';
import { Search, Download, MessageCircle, Calendar, Users, TrendingUp, X, AlertCircle, Edit, Mail, DollarSign, CheckCircle, UserCheck, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import type { Venta } from '../types/venta';
import type { Cliente } from '../types/cliente';

export default function GestionClientes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { clientes: todosLosClientes, loading, error } = useClientes(user);
  const permisos = usePermisos(user);
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
      toast.error('El teléfono es obligatorio');
      return;
    }
    if (!/^\d+$/.test(formEditar.telefono.trim())) {
      toast.error('El teléfono solo debe contener números');
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

    try {
      const clienteRef = doc(db, 'clientes', clienteEditando!.id);
      await updateDoc(clienteRef, {
        nombre: formEditar.nombre.trim(),
        telefono: formEditar.telefono.trim(),
        correo: formEditar.correo.trim(),
        plataforma: formEditar.plataforma.trim(),
      });

      toast.success('✅ Cliente actualizado correctamente');
      setMostrarEditar(false);
      setClienteEditando(null);
    } catch (error: unknown) {
      console.error('Error actualizando cliente:', error);
      toast.error('Error al actualizar el cliente');
    }
  };

  // 📱 Enviar WhatsApp
  const enviarWhatsApp = (cliente: Cliente) => {
    const dias = Math.abs(cliente.diasRestantes ?? 0);
    const mensaje = (cliente.diasRestantes ?? 0) > 0
      ? `Hola ${cliente.nombre}, tu servicio de ${cliente.plataforma || 'streaming'} vence en ${dias} día(s). Te invitamos a renovarlo para seguir disfrutando sin interrupciones.`
      : `Hola ${cliente.nombre}, te informamos que tu servicio de ${cliente.plataforma || 'streaming'} finalizó hace ${dias} días. Para seguir accediendo a tus series y películas favoritas sin interrupciones, podés renovar tu plan. Si no deseas continuar, no es necesario que hagas nada. ¡Gracias por confiar en nosotros!`;
    const url = `https://wa.me/57${cliente.telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  // 🔍 Filtrado por búsqueda + ordenado por fecha de vencimiento
  const clientesFiltrados: Cliente[] = (clientes[filtro]?.filter(
    (c: Cliente) =>
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.plataforma && c.plataforma.toLowerCase().includes(busqueda.toLowerCase())) ||
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

      toast.success(`✅ Pago de $${monto.toLocaleString()} registrado correctamente`);
      setMostrarCobrar(false);
      setClienteCobrar(null);
      setMontoPago('');
    } catch (error: unknown) {
      console.error('Error registrando pago:', error);
      toast.error('Error al registrar el pago');
    }
  };

  const abrirHistorial = (cliente: Cliente) => {
    setClienteSeleccionado(cliente);
    setMostrarHistorial(true);
    cargarHistorial(cliente.nombre);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando clientes...</p>
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
      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-700">
          {user?.rol === 'admin' ? 'Gestión de Clientes — Plataforma' : 'Gestión de Clientes'}
        </h1>
        <p className="text-gray-600">Administra y contacta a tus clientes</p>
      </div>

      {/* Controles */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            {(['activos', 'inactivos', 'todos'] as const).map((tipo) => (
              <button
                key={tipo}
                onClick={() => setFiltro(tipo)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filtro === tipo
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg'
                    : 'bg-white/80 text-gray-700 hover:bg-white'
                  }`}
              >
                {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
              </button>
            ))}
          </div>

          {/* Búsqueda */}
          <div className="flex-1 relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar cliente, plataforma o teléfono..."
              value={busqueda}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusqueda(e.target.value)}
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

      {/* Resumen agregado para admin */}
      {user?.rol === 'admin' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card cursor-default">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Users className="text-white" size={24} />
              </div>
              <Users className="text-blue-400" size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Total Clientes</p>
              <p className="text-2xl font-bold text-gray-900">{clientes.todos.length.toLocaleString()}</p>
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
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Clientes Activos</p>
              <p className="text-2xl font-bold text-gray-900">{clientes.activos.length.toLocaleString()}</p>
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
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Clientes Vencidos</p>
              <p className="text-2xl font-bold text-gray-900">{clientes.inactivos.length.toLocaleString()}</p>
            </div>
          </div>
          <div className="card cursor-default">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <UserCheck className="text-white" size={24} />
              </div>
              <UserCheck className="text-purple-400" size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Vendedores</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(clientes.todos.map(c => c.propietarioId).filter(Boolean)).size.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Banner de límite para Starter */}
      {user?.rol !== 'admin' && permisos.planNombre === 'Starter' && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <Sparkles className="text-amber-500 shrink-0" size={20} />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              Plan Starter — <strong>{clientes.todos.length}</strong> de {permisos.clienteLimit} clientes usados
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Actualizá a Professional para clientes ilimitados.
            </p>
          </div>
        </div>
      )}

      {/* Lista de clientes */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {user?.rol === 'admin' && (
          <div className="px-6 pt-4 pb-2">
            <p className="text-sm text-gray-500 italic">Vista general de todos los vendedores de la plataforma</p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-indigo-600 text-white">
                <th className="px-4 py-4 text-left text-sm font-semibold">Cliente</th>
                {user?.rol === 'admin' && (
                  <th className="px-4 py-4 text-left text-sm font-semibold">Vendedor</th>
                )}
                <th className="px-4 py-4 text-left text-sm font-semibold">Contacto</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Plataforma</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Vencimiento</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Días Restantes</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Estado Pago</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.length > 0 ? (
                clientesPaginados.map((c: Cliente) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-100 hover:bg-indigo-50/30 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div className="font-semibold text-gray-900">{c.nombre}</div>
                      {c.correo && (
                        <div className="text-xs text-gray-500 mt-1">{c.correo}</div>
                      )}
                    </td>
                    {user?.rol === 'admin' && (
                      <td className="px-4 py-4">
                        <div className="text-gray-700">{c.usuarioEmail || '—'}</div>
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div className="text-gray-700">{c.telefono}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium">
                        {c.plataforma || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Calendar size={16} className="text-gray-400" />
                        {c.fechaVencimiento
                          ? new Date(c.fechaVencimiento).toLocaleDateString('es-CO')
                          : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${c.diasRestantes! > 7
                            ? 'bg-green-100 text-green-700'
                            : c.diasRestantes! > 0
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                      >
                        {c.diasRestantes! > 0 ? `${c.diasRestantes} días` : 'Vencido'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {c.saldoPendiente > 0 ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-semibold">
                          <AlertCircle size={14} />
                          Debe ${c.saldoPendiente.toLocaleString()}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
                          Al día
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => abrirEditar(c)}
                          className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                          title="Editar cliente"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => abrirHistorial(c)}
                          className="p-2 rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors"
                          title="Ver historial"
                        >
                          <TrendingUp size={18} />
                        </button>
                        {c.saldoPendiente > 0 && (
                          <button
                            onClick={() => {
                              setClienteCobrar(c);
                              setMontoPago(String(c.saldoPendiente));
                              setMostrarCobrar(true);
                            }}
                            className="p-2 rounded-lg bg-orange-100 text-orange-600 hover:bg-orange-200 transition-colors"
                            title="Registrar pago"
                          >
                            <DollarSign size={18} />
                          </button>
                          )}
                        <button
                          onClick={() => navigate('/ventas', { state: { cliente: c } })}
                          className="p-2 rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors"
                          title="Renovar cliente"
                        >
                          <RefreshCw size={18} />
                        </button>
                        <button
                          onClick={() => enviarWhatsApp(c)}
                          className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                          title="Contactar por WhatsApp"
                        >
                          <MessageCircle size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={user?.rol === 'admin' ? 8 : 7} className="text-center py-12 text-gray-500">
                    <Users size={48} className="mx-auto mb-3 text-gray-300" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card max-w-2xl w-full animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Editar Cliente</h2>
                <p className="text-gray-600 mt-1">Actualiza la información del cliente</p>
              </div>
              <button
                onClick={() => {
                  setMostrarEditar(false);
                  setClienteEditando(null);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>

            <form onSubmit={guardarEdicion} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre del cliente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formEditar.nombre}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormEditar({ ...formEditar, nombre: e.target.value })}
                  className="w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Teléfono <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formEditar.telefono}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormEditar({ ...formEditar, telefono: e.target.value })}
                  className="w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={formEditar.correo}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormEditar({ ...formEditar, correo: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Plataforma <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formEditar.plataforma}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormEditar({ ...formEditar, plataforma: e.target.value })}
                  className="w-full"
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
                <button type="submit" className="btn-primary flex-1">
                  💾 Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de historial */}
      {mostrarHistorial && clienteSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Historial de Ventas</h2>
                <p className="text-gray-600 mt-1">{clienteSeleccionado.nombre}</p>
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
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>

            {historialVentas.length > 0 ? (
              <div className="space-y-3">
                {historialVentas.map((venta: Venta) => (
                  <div
                    key={venta.id}
                    className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{venta.plataforma}</div>
                        {venta.correo && (
                          <div className="text-sm text-indigo-600 mt-1 flex items-center gap-1">
                            <Mail size={14} />
                            {venta.correo}
                          </div>
                        )}
                        <div className="text-sm text-gray-600 mt-1">
                          {venta.pantallas} pantalla(s) • ${(venta.precioVenta * venta.pantallas).toLocaleString()}
                        </div>
                        {venta.perfil && (
                          <div className="text-xs text-gray-500 mt-1">
                            Perfil: <span className="font-medium">{venta.perfil}</span>
                            {venta.pinPerfil && (
                              <> • PIN: <span className="font-medium">{venta.pinPerfil}</span></>
                            )}
                          </div>
                        )}
                        {venta.fechaRegistro?.seconds && (
                          <div className="text-xs text-gray-500 mt-1">
                            Fecha venta: {new Date(venta.fechaRegistro.seconds * 1000).toLocaleDateString('es-CO', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </div>
                        )}
                        {venta.fechaVencimiento && (
                          <div className="text-xs text-indigo-600 mt-1 font-medium flex items-center gap-1">
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
                        <div className="text-lg font-bold text-green-600">
                          Utilidad: ${venta.utilidad?.toLocaleString() || '0'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>No hay ventas registradas para este cliente</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de cobro */}
      {mostrarCobrar && clienteCobrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card max-w-md w-full animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Registrar Pago</h2>
                <p className="text-gray-600 mt-1">{clienteCobrar.nombre}</p>
              </div>
              <button
                onClick={() => {
                  setMostrarCobrar(false);
                  setClienteCobrar(null);
                  setMontoPago('');
                }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>

            <form onSubmit={registrarPago} className="space-y-4">
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <p className="text-sm text-gray-600">
                  Saldo pendiente:{' '}
                  <span className="font-bold text-orange-700">
                    ${clienteCobrar.saldoPendiente.toLocaleString()}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Monto a cobrar <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={montoPago}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMontoPago(e.target.value)}
                    className="w-full pl-8"
                    min="0.01"
                    max={clienteCobrar.saldoPendiente}
                    step="0.01"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Máximo: ${clienteCobrar.saldoPendiente.toLocaleString()}
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
                  className="btn-primary flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                >
                  💰 Cobrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
