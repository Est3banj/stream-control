import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, setDoc, doc, serverTimestamp, getDoc, increment, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function VentasForm() {
  const { user } = useAuth();
  const [venta, setVenta] = useState({
    nombre: '',
    telefono: '',
    correo: '',
    plataforma: '',
    pantallas: 1,
    precioVenta: 0,
    costoServicio: 0,
    fechaInicio: '',
    diasServicio: '',
    perfil: '',
    pinPerfil: '',
    pagado: true,
    saldoPendiente: '',
  });

  const [utilidad, setUtilidad] = useState(0);

  // 🧮 Calcula utilidad
  useEffect(() => {
    const p = Number(venta.precioVenta) || 0;
    const c = Number(venta.costoServicio) || 0;
    const pant = Number(venta.pantallas) || 0;
    setUtilidad((pant * p) - c);
  }, [venta.precioVenta, venta.costoServicio, venta.pantallas]);

  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    setVenta({ ...venta, [name]: type === 'checkbox' ? checked : value });
  };

  // 🔍 Autocompletar si el cliente ya existe
  const handleBlurNombre = async () => {
    if (!user || !venta.nombre.trim()) return;
    try {
      const clienteRef = doc(db, 'clientes', `${user.uid}_${venta.nombre.trim()}`);
      const clienteSnap = await getDoc(clienteRef);
      if (clienteSnap.exists()) {
        const data = clienteSnap.data();
        setVenta(prev => ({
          ...prev,
          telefono: data.telefono || '',
          correo: data.correo || '',
          plataforma: data.plataforma || '',
        }));
        toast.success('Cliente existente cargado automáticamente');
      }
    } catch (error) {
      console.error('Error cargando cliente:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error("Error: Usuario no autenticado.");
      return;
    }

    // Validaciones
    if (!venta.nombre.trim()) return toast.error("El nombre del cliente es obligatorio.");
    if (!venta.telefono.trim()) return toast.error("El teléfono es obligatorio.");
    if (!venta.plataforma.trim()) return toast.error("La plataforma o servicio es obligatorio.");
    if (!venta.fechaInicio.trim()) return toast.error("La fecha de inicio es obligatoria.");

    if (!venta.diasServicio || isNaN(venta.diasServicio) || Number(venta.diasServicio) <= 0)
      return toast.error("La duración del servicio debe ser válida.");

    if (!venta.pantallas || isNaN(venta.pantallas) || Number(venta.pantallas) < 1)
      return toast.error("La cantidad de pantallas debe ser válida.");

    if (venta.precioVenta === '' || isNaN(venta.precioVenta) || Number(venta.precioVenta) < 0)
      return toast.error("El precio de venta debe ser válido.");

    if (venta.costoServicio === '' || isNaN(venta.costoServicio) || Number(venta.costoServicio) < 0)
      return toast.error("El costo del servicio debe ser válido.");

    if (!venta.pagado && (venta.saldoPendiente === '' || isNaN(venta.saldoPendiente) || Number(venta.saldoPendiente) <= 0))
      return toast.error("Indicá el saldo pendiente cuando el pago está incompleto.");

    if (venta.telefono && !/^\d+$/.test(venta.telefono.trim()))
      return toast.error("El teléfono solo debe contener números.");

    if (venta.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(venta.correo.trim()))
      return toast.error("El correo electrónico no es válido.");

    try {
      // Calcular fecha de vencimiento
      const fechaInicioDate = new Date(venta.fechaInicio);
      const dias = Number(venta.diasServicio);
      const fechaVencimientoDate = new Date(fechaInicioDate);
      fechaVencimientoDate.setDate(fechaVencimientoDate.getDate() + dias);
      const fechaVencimiento = fechaVencimientoDate.toISOString().split('T')[0];

      // 🟢 Datos listos para Firestore (con tipos CORRECTOS)
      const nuevaVenta = {
        ...venta,
        pantallas: Number(venta.pantallas),
        precioVenta: Number(venta.precioVenta),
        costoServicio: Number(venta.costoServicio),
        utilidad: Number(utilidad),
        pagado: venta.pagado,
        saldoPendiente: venta.pagado ? 0 : Number(venta.saldoPendiente || 0),

        fechaRegistro: serverTimestamp(),    // Fecha real del sistema (no alterable por el usuario)

        propietarioId: user.uid,
        usuarioEmail: user.email,
        fechaVencimiento,
      };

      // 🟢 Guardar venta
      await addDoc(collection(db, 'ventas'), nuevaVenta);

      // 🟢 Registrar / actualizar cliente
      await setDoc(doc(db, 'clientes', `${user.uid}_${venta.nombre}`), {
        nombre: venta.nombre,
        telefono: venta.telefono,
        correo: venta.correo,
        estado: 'activo',
        plataforma: venta.plataforma,
        propietarioId: user.uid,
        usuarioEmail: user.email,
        fechaVencimiento,
      }, { merge: true });

      // Si el cliente queda debiendo, acumular saldo en su ficha
      if (!venta.pagado) {
        await updateDoc(doc(db, 'clientes', `${user.uid}_${venta.nombre}`), {
          saldoPendiente: increment(Number(venta.saldoPendiente)),
        });
      }

      // 🟢 Registrar movimiento financiero
      await addDoc(collection(db, 'movimientos'), {
        tipo: 'Ingreso',
        monto: Number(venta.pantallas) * Number(venta.precioVenta),
        descripcion: `Venta de ${venta.plataforma} (${venta.pantallas} pantallas)`,
        fecha: serverTimestamp(),
        propietarioId: user.uid,
        usuarioEmail: user.email,
      });

      toast.success('Venta registrada correctamente');

      setVenta({
        nombre: '',
        telefono: '',
        correo: '',
        plataforma: '',
        pantallas: 1,
        precioVenta: 0,
        costoServicio: 0,
        fechaInicio: '',
        diasServicio: '',
        perfil: '',
        pinPerfil: '',
        pagado: true,
        saldoPendiente: '',
      });
      setUtilidad(0);

    } catch (error) {
      console.error('❌ Error al registrar la venta:', error);
      toast.error("Error al registrar la venta. Inténtelo nuevamente.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card max-w-4xl mx-auto space-y-8">

      {/* =========================
          1. Información del Cliente
      ========================== */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">1</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Información del Cliente</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          <div className="md:col-span-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nombre del cliente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nombre"
              value={venta.nombre}
              onChange={handleChange}
              onBlur={handleBlurNombre}
              placeholder="Ej: Juan Pérez"
              className="w-full"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Se autocompletará si el cliente existe
            </p>
          </div>

          <div className="md:col-span-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Teléfono <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="telefono"
              value={venta.telefono}
              onChange={handleChange}
              placeholder="Ej: 3104567890"
              className="w-full"
              required
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Correo electrónico
            </label>
            <input
              type="email"
              name="correo"
              value={venta.correo}
              onChange={handleChange}
              placeholder="correo@ejemplo.com"
              className="w-full"
            />
          </div>

        </div>
      </div>

      {/* =========================
          2. Detalles del Servicio
      ========================== */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">2</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Detalles del Servicio</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Plataforma o servicio <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="plataforma"
              value={venta.plataforma}
              onChange={handleChange}
              placeholder="Ej: Netflix, Disney+, Spotify..."
              className="w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Cantidad de pantallas <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="pantallas"
              value={venta.pantallas}
              onChange={handleChange}
              className="w-full"
              min="1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Fecha de inicio <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="fechaInicio"
              value={venta.fechaInicio}
              onChange={handleChange}
              className="w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Duración del servicio (días) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="diasServicio"
              value={venta.diasServicio}
              onChange={handleChange}
              className="w-full"
              min="1"
              placeholder="Ej: 30, 60, 90"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Perfil
            </label>
            <input
              type="text"
              name="perfil"
              value={venta.perfil}
              onChange={handleChange}
              placeholder="Ej: Principal, Kids..."
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Opcional — nombre del perfil asignado
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              PIN del perfil
            </label>
            <input
              type="text"
              name="pinPerfil"
              value={venta.pinPerfil}
              onChange={handleChange}
              placeholder="Ej: 1234"
              className="w-full"
              maxLength="10"
            />
            <p className="text-xs text-gray-500 mt-1">
              Opcional — PIN de bloqueo si aplica
            </p>
          </div>
        </div>
      </div>

      {/* =========================
          3. Valores Financieros
      ========================== */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">3</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Valores Financieros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Precio de venta (por pantalla) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                name="precioVenta"
                value={venta.precioVenta}
                onChange={handleChange}
                className="w-full pl-8"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Costo del servicio <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                name="costoServicio"
                value={venta.costoServicio}
                onChange={handleChange}
                className="w-full pl-8"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>

        </div>

        {/* Utilidad calculada */}
        <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Utilidad estimada</p>
              <p className="text-3xl font-bold text-green-600">
                ${utilidad.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl">💰</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Calculado automáticamente: (Pantallas × Precio) - Costo
          </p>
        </div>
      </div>

      {/* =========================
          Estado de Pago
      ========================== */}
      <div className="space-y-6 mt-8 pt-6 border-t border-gray-200">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">$</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Estado de Pago</h2>
        </div>

        <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
          <div>
            <p className="font-semibold text-gray-700">Pagó completo</p>
            <p className="text-sm text-gray-500">El cliente ya pagó el total del servicio</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="pagado"
              checked={venta.pagado}
              onChange={handleChange}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-yellow-500 peer-checked:to-orange-600"></div>
          </label>
        </div>

        {!venta.pagado && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Saldo pendiente <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                name="saldoPendiente"
                value={venta.saldoPendiente}
                onChange={handleChange}
                className="w-full pl-8"
                min="0"
                step="0.01"
                placeholder="0.00"
                required={!venta.pagado}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Monto que el cliente aún debe pagar
            </p>
          </div>
        )}
      </div>

      {/* =========================
          Botón de Envío
      ========================== */}
      <div className="pt-4 border-t border-gray-200">
        <button
          type="submit"
          className="btn-primary w-full py-4 text-lg font-semibold flex items-center justify-center gap-2"
        >
          <span></span>
          Registrar Venta
        </button>
      </div>

    </form>
  );
}