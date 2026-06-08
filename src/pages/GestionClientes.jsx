import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Search, Download, MessageCircle, Calendar, Users, TrendingUp, X, AlertCircle, Edit, Mail } from 'lucide-react';

export default function GestionClientes() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState({ activos: [], inactivos: [], todos: [] });
  const [filtro, setFiltro] = useState('activos');
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [historialVentas, setHistorialVentas] = useState([]);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [mostrarEditar, setMostrarEditar] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [formEditar, setFormEditar] = useState({
    nombre: '',
    telefono: '',
    correo: '',
    plataforma: '',
  });

  // 🔄 Cargar clientes en tiempo real
  useEffect(() => {
    if (!user) return;

    let q;
    if (user.rol === 'admin') {
      q = collection(db, 'clientes');
    } else {
      q = query(collection(db, 'clientes'), where('propietarioId', '==', user.uid));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const hoy = new Date();
      const data = snapshot.docs.map(doc => {
        const c = { id: doc.id, ...doc.data() };
        const fechaVenc = new Date(c.fechaVencimiento);
        const diasRestantes = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
        return { ...c, diasRestantes };
      });

      const activos = data.filter(c => c.diasRestantes > 0);
      const inactivos = data.filter(c => c.diasRestantes <= 0);

      setClientes({ activos, inactivos, todos: data });
      setLoading(false);
    }, (error) => {
      console.error('Error cargando clientes:', error);
      toast.error('Error al cargar clientes');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 🔍 Cargar historial de ventas de un cliente
  const cargarHistorial = async (clienteNombre) => {
    if (!user) return;

    try {
      let q = query(collection(db, 'ventas'), where('nombre', '==', clienteNombre));
      if (user.rol !== 'admin') {
        q = query(q, where('propietarioId', '==', user.uid));
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ventas = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })).sort((a, b) => {
          const fechaA = a.fechaRegistro?.seconds || 0;
          const fechaB = b.fechaRegistro?.seconds || 0;
          return fechaB - fechaA;
        });
        setHistorialVentas(ventas);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error cargando historial:', error);
      toast.error('Error al cargar historial de ventas');
    }
  };

  // ✏️ Abrir modal de edición
  const abrirEditar = (cliente) => {
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
  const guardarEdicion = async (e) => {
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
      const clienteRef = doc(db, 'clientes', clienteEditando.id);
      await updateDoc(clienteRef, {
        nombre: formEditar.nombre.trim(),
        telefono: formEditar.telefono.trim(),
        correo: formEditar.correo.trim(),
        plataforma: formEditar.plataforma.trim(),
      });

      toast.success('✅ Cliente actualizado correctamente');
      setMostrarEditar(false);
      setClienteEditando(null);
    } catch (error) {
      console.error('Error actualizando cliente:', error);
      toast.error('Error al actualizar el cliente');
    }
  };

  // 📱 Enviar WhatsApp
  const enviarWhatsApp = (cliente) => {
    const mensaje = `Hola ${cliente.nombre}, tu servicio de ${cliente.plataforma || 'streaming'} vence en ${cliente.diasRestantes} día(s). Te invitamos a renovarlo para seguir disfrutando sin interrupciones.`;
    const url = `https://wa.me/57${cliente.telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  // 🔍 Filtrado por búsqueda
  const clientesFiltrados = clientes[filtro]?.filter(
    (c) =>
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.plataforma && c.plataforma.toLowerCase().includes(busqueda.toLowerCase())) ||
      (c.telefono && c.telefono.includes(busqueda))
  ) || [];

  // 📤 Exportar datos a CSV
  const exportarCSV = () => {
    if (!clientesFiltrados.length) {
      toast.error('No hay clientes para exportar');
      return;
    }

    const encabezados = ['Nombre', 'Teléfono', 'Correo', 'Plataforma', 'Fecha de Vencimiento', 'Días Restantes', 'Estado'];
    const filas = clientesFiltrados.map((c) => [
      c.nombre,
      c.telefono,
      c.correo || '-',
      c.plataforma || '-',
      c.fechaVencimiento || '-',
      c.diasRestantes || 0,
      c.diasRestantes > 0 ? 'Activo' : 'Inactivo',
    ]);

    const csvContent = [encabezados, ...filas].map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `clientes_${filtro}_${new Date().toISOString().split('T')[0]}.csv`;
    enlace.click();
    toast.success('CSV exportado correctamente');
  };

  const abrirHistorial = (cliente) => {
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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600">
          Gestión de Clientes
        </h1>
        <p className="text-gray-600">Administra y contacta a tus clientes</p>
      </div>

      {/* Controles */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            {['activos', 'inactivos', 'todos'].map((tipo) => (
              <button
                key={tipo}
                onClick={() => setFiltro(tipo)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filtro === tipo
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
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

      {/* Lista de clientes */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                <th className="px-4 py-4 text-left text-sm font-semibold">Cliente</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Contacto</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Plataforma</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Vencimiento</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Días Restantes</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.length > 0 ? (
                clientesFiltrados.map((c) => (
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
                    <td className="px-4 py-4">
                      <div className="text-gray-700">{c.telefono}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-medium">
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
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${c.diasRestantes > 7
                            ? 'bg-green-100 text-green-700'
                            : c.diasRestantes > 0
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                      >
                        {c.diasRestantes > 0 ? `${c.diasRestantes} días` : 'Vencido'}
                      </span>
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
                  <td colSpan="6" className="text-center py-12 text-gray-500">
                    <Users size={48} className="mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">No se encontraron clientes {filtro}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                  onChange={(e) => setFormEditar({ ...formEditar, nombre: e.target.value })}
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
                  onChange={(e) => setFormEditar({ ...formEditar, telefono: e.target.value })}
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
                  onChange={(e) => setFormEditar({ ...formEditar, correo: e.target.value })}
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
                  onChange={(e) => setFormEditar({ ...formEditar, plataforma: e.target.value })}
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
                {historialVentas.map((venta) => (
                  <div
                    key={venta.id}
                    className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100"
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
    </div>
  );
}