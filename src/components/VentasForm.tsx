import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, setDoc, doc, serverTimestamp, getDoc, increment, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import usePermisos from '../hooks/usePermisos';
import SelectorCuenta from '../components/SelectorCuenta';
import { Check } from 'lucide-react';
import toast from 'react-hot-toast';
import type { VentaInput } from '../types/venta';

interface VentaFormState {
  nombre: string;
  telefono: string;
  correo: string;
  plataforma: string;
  pantallas: number;
  precioVenta: number;
  costoServicio: number;
  fechaInicio: string;
  diasServicio: string;
  fechaVenta: string;
  perfil: string;
  pinPerfil: string;
  pagado: boolean;
  saldoPendiente: string;
}

interface VentasFormProps {
  initialData?: Partial<VentaFormState>;
}

const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function VentasForm({ initialData }: VentasFormProps) {
  const { user } = useAuth();
  const permisos = usePermisos(user);
  const [venta, setVenta] = useState<VentaFormState>({
    nombre: initialData?.nombre ?? '',
    telefono: initialData?.telefono ?? '',
    correo: initialData?.correo ?? '',
    plataforma: initialData?.plataforma ?? '',
    pantallas: initialData?.pantallas ?? 1,
    precioVenta: initialData?.precioVenta ?? 0,
    costoServicio: initialData?.costoServicio ?? 0,
    fechaInicio: initialData?.fechaInicio ?? '',
    diasServicio: initialData?.diasServicio ?? '',
    fechaVenta: initialData?.fechaVenta ?? getToday(),
    perfil: initialData?.perfil ?? '',
    pinPerfil: initialData?.pinPerfil ?? '',
    pagado: initialData?.pagado ?? true,
    saldoPendiente: initialData?.saldoPendiente ?? '',
  });

  useEffect(() => {
    if (initialData) {
      setVenta(prev => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  const [utilidad, setUtilidad] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [mostrarFechaVenta, setMostrarFechaVenta] = useState(false);
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [perfilAsignado, setPerfilAsignado] = useState<string | null>(null);
  const [perfilPinSeleccionado, setPerfilPinSeleccionado] = useState<string | null>(null);
  const [costoPorPerfil, setCostoPorPerfil] = useState<number>(0);

  // 🧮 Calcula utilidad
  useEffect(() => {
    const p = Number(venta.precioVenta) || 0;
    const c = Number(venta.costoServicio) || 0;
    const pant = Number(venta.pantallas) || 0;
    const cp = costoPorPerfil || 0;
    setUtilidad((pant * p) - (cp || c));
  }, [venta.precioVenta, venta.costoServicio, venta.pantallas, costoPorPerfil]);

  const handleToggleFechaVenta = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setMostrarFechaVenta(checked);
    if (!checked) {
      setVenta(prev => ({ ...prev, fechaVenta: getToday() }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, value, checked } = e.target;
    setVenta({ ...venta, [name]: type === 'checkbox' ? checked : value } as VentaFormState);
  };

  // 🔍 Autocompletar si el nombre ya existe
  const handleBlurNombre = async () => {
    if (!user || !venta.nombre.trim()) return;
    try {
      const clienteRef = doc(db, 'clientes', `${user.uid}_${venta.nombre.trim()}`);
      const clienteSnap = await getDoc(clienteRef);
      if (clienteSnap.exists()) {
        const data = clienteSnap.data() as { telefono?: string; correo?: string; plataforma?: string };
        setVenta(prev => ({
          ...prev,
          telefono: data.telefono || '',
          correo: data.correo || '',
          plataforma: data.plataforma || '',
        }));
        toast.success('Cliente existente cargado automáticamente');
      }
    } catch (error: unknown) {
      console.error('Error cargando cliente:', error);
    }
  };

  // 🔍 Autocompletar por teléfono
  const handleBlurTelefono = async () => {
    if (!user || !venta.telefono.trim()) return;
    try {
      const q = query(
        collection(db, 'clientes'),
        where('propietarioId', '==', user.uid),
        where('telefono', '==', venta.telefono.trim())
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as { nombre?: string; correo?: string; plataforma?: string };
        setVenta(prev => ({
          ...prev,
          nombre: data.nombre || prev.nombre,
          correo: data.correo || '',
          plataforma: data.plataforma || '',
        }));
        toast.success('Cliente encontrado por teléfono');
      }
    } catch (error: unknown) {
      console.error('Error buscando por teléfono:', error);
    }
  };

  const handleCuentaSelected = (newCuentaId: string | null, newPerfilNombre: string | null, newPerfilPin: string | null, newCostoPorPerfil: number) => {
    setCuentaId(newCuentaId);
    setPerfilAsignado(newPerfilNombre);
    setPerfilPinSeleccionado(newPerfilPin);
    setCostoPorPerfil(newCostoPorPerfil);
    setVenta(prev => ({
      ...prev,
      perfil: newPerfilNombre || prev.perfil,
      pinPerfil: newPerfilPin || prev.pinPerfil,
      costoServicio: newCostoPorPerfil || prev.costoServicio,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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

    if (!venta.diasServicio || isNaN(venta.diasServicio as unknown as number) || Number(venta.diasServicio) <= 0)
      return toast.error("La duración del servicio debe ser válida.");

    if (!venta.pantallas || isNaN(venta.pantallas) || Number(venta.pantallas) < 1)
      return toast.error("La cantidad de pantallas debe ser válida.");

    if (venta.precioVenta === 0 || isNaN(venta.precioVenta) || Number(venta.precioVenta) < 0)
      return toast.error("El precio de venta debe ser válido.");

    if (venta.costoServicio === 0 || isNaN(venta.costoServicio) || Number(venta.costoServicio) < 0)
      return toast.error("El costo del servicio debe ser válido.");

    if (!venta.pagado && (venta.saldoPendiente === '' || isNaN(venta.saldoPendiente as unknown as number) || Number(venta.saldoPendiente) <= 0))
      return toast.error("Indicá el saldo pendiente cuando el pago está incompleto.");

    if (venta.telefono && !/^\d+$/.test(venta.telefono.trim()))
      return toast.error("El teléfono solo debe contener números.");

    if (venta.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(venta.correo.trim()))
      return toast.error("El correo electrónico no es válido.");

    // 🚫 Validar que el teléfono no esté registrado con otro cliente
    try {
      const dupQuery = query(
        collection(db, 'clientes'),
        where('propietarioId', '==', user.uid),
        where('telefono', '==', venta.telefono.trim())
      );
      const dupSnap = await getDocs(dupQuery);
      if (!dupSnap.empty) {
        const existingName = dupSnap.docs[0].data().nombre as string;
        if (existingName !== venta.nombre.trim()) {
          return toast.error(
            `El teléfono ${venta.telefono} ya está registrado con "${existingName}". Usá otro teléfono o editá el cliente existente.`
          );
        }
      }
    } catch (_e) {
      // Si falla la verificación, permitimos seguir
      console.warn('No se pudo verificar teléfono duplicado');
    }

    // 🚫 Hard-block: límite de clientes para Starter
    if (permisos.clienteLimit !== Infinity) {
      try {
        const countQuery = query(
          collection(db, 'clientes'),
          where('propietarioId', '==', user.uid)
        );
        const countSnap = await getDocs(countQuery);
        if (countSnap.size >= permisos.clienteLimit) {
          return toast.error(
            `Alcanzaste el límite de ${permisos.clienteLimit} clientes del plan Starter. ` +
            'Actualizá a Professional para clientes ilimitados.'
          );
        }
      } catch (_e) {
        console.warn('No se pudo verificar límite de clientes');
      }
    }

    setSubmitting(true);

    try {
      // Calcular fecha de vencimiento
      const fechaInicioDate = new Date(venta.fechaInicio);
      const dias = Number(venta.diasServicio);
      const fechaVencimientoDate = new Date(fechaInicioDate);
      fechaVencimientoDate.setDate(fechaVencimientoDate.getDate() + dias);
      const fechaVencimiento = fechaVencimientoDate.toISOString().split('T')[0];

      // 🟢 Datos listos para Firestore (con tipos CORRECTOS)
      const nuevaVenta: VentaInput = {
        ...venta,
        diasServicio: Number(venta.diasServicio),
        pantallas: Number(venta.pantallas),
        precioVenta: Number(venta.precioVenta),
        costoServicio: Number(venta.costoServicio),
        utilidad: Number(utilidad),
        pagado: venta.pagado,
        saldoPendiente: venta.pagado ? 0 : Number(venta.saldoPendiente || 0),

        fechaRegistro: serverTimestamp(),
        fechaRegistroSistema: null,
        fechaVenta: venta.fechaVenta,

        propietarioId: user.uid!,
        usuarioEmail: user.email!,
        fechaVencimiento,
        ...(cuentaId ? { cuentaId } : {}),
        ...(perfilAsignado ? { perfilNombre: perfilAsignado } : {}),
        ...(perfilPinSeleccionado ? { perfilPin: perfilPinSeleccionado } : {}),
        ...(costoPorPerfil ? { costoPorPerfil } : {}),
      };

      // 🟢 Guardar venta
      try {
        await addDoc(collection(db, 'ventas'), nuevaVenta);
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        console.error('❌ Falló addDoc a ventas:', error.code, error.message);
        console.log('Datos de venta:', JSON.stringify(nuevaVenta, (k, v) =>
          typeof v === 'function' ? v.name : v
        ));
        throw err;
      }

      // 🟢 Registrar / actualizar cliente
      const clienteRef = doc(db, 'clientes', `${user.uid}_${venta.nombre}`);
      const clienteData = {
        nombre: venta.nombre,
        telefono: venta.telefono,
        correo: venta.correo,
        estado: 'activo',
        plataforma: venta.plataforma,
        propietarioId: user.uid,
        usuarioEmail: user.email,
        fechaVencimiento,
        ...(cuentaId ? { cuentaId, perfilAsignado: perfilAsignado || '' } : {}),
      };
      try {
        await setDoc(clienteRef, clienteData, { merge: true });
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        console.error('❌ Falló setDoc a clientes:', error.code, error.message);
        console.log('Datos de cliente:', JSON.stringify(clienteData));
        throw err;
      }

      // Si el cliente queda debiendo, acumular saldo en su ficha
      if (!venta.pagado) {
        try {
          await updateDoc(clienteRef, {
            saldoPendiente: increment(Number(venta.saldoPendiente)),
          });
        } catch (err: unknown) {
          const error = err as { code?: string; message?: string };
          console.error('❌ Falló updateDoc saldoPendiente:', error.code, error.message);
          throw err;
        }
      }

      // 🟢 Registrar movimiento financiero
      const movimientoData = {
        tipo: 'Ingreso',
        monto: Number(venta.pantallas) * Number(venta.precioVenta),
        descripcion: `Venta de ${venta.plataforma} (${venta.pantallas} pantallas)`,
        fecha: serverTimestamp(),
        propietarioId: user.uid,
        usuarioEmail: user.email,
      };
      try {
        await addDoc(collection(db, 'movimientos'), movimientoData);
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        console.error('❌ Falló addDoc a movimientos:', error.code, error.message);
        console.log('Datos de movimiento:', JSON.stringify(movimientoData));
        throw err;
      }

      // 🟢 Marcar el perfil como asignado en la cuenta
      if (cuentaId && perfilAsignado) {
        try {
          const cuentaRef = doc(db, 'cuentas', cuentaId);
          const cuentaSnap = await getDoc(cuentaRef);
          if (cuentaSnap.exists()) {
            const perfiles = cuentaSnap.data().perfiles;
            if (Array.isArray(perfiles)) {
              const idx = perfiles.findIndex((p: { nombre: string }) => p.nombre === perfilAsignado);
              if (idx !== -1) {
                const hoy = new Date().toISOString().split('T')[0];
                perfiles[idx] = {
                  ...perfiles[idx],
                  estado: 'asignado',
                  clienteNombre: venta.nombre.trim(),
                  fechaAsignacion: hoy,
                };
                const quedanDisponibles = perfiles.some((p: { estado: string }) => p.estado === 'disponible');
                await updateDoc(cuentaRef, {
                  perfiles,
                  ...(quedanDisponibles ? {} : { estado: 'asignada' as const }),
                  updatedAt: serverTimestamp(),
                });
              }
            }
          }
        } catch (err) {
          console.warn('⚠️ No se pudo marcar el perfil como asignado en la cuenta:', err);
        }
      }

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
        fechaVenta: getToday(),
        perfil: '',
        pinPerfil: '',
        pagado: true,
        saldoPendiente: '',
      });
      setUtilidad(0);
      setMostrarFechaVenta(false);
      setCuentaId(null);
      setPerfilAsignado(null);
      setPerfilPinSeleccionado(null);
      setCostoPorPerfil(0);

    } catch (error: unknown) {
      console.error('❌ Error al registrar la venta:', error);
      toast.error("Error al registrar la venta. Inténtelo nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const SectionIcon = ({ number }: { number: string }) => (
    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm flex-shrink-0">
      <span className="text-white font-bold text-sm">{number}</span>
    </div>
  );

  const InputLabel = ({ children, required = false }: { children: React.ReactNode; required?: boolean }) => (
    <label className="block text-sm font-medium text-gray-600 mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">

      {/* =========================
          1. Información del Cliente
      ========================== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <SectionIcon number="1" />
          <h2 className="text-lg font-semibold text-gray-900">Información del Cliente</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <InputLabel required>Nombre del cliente</InputLabel>
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
            <p className="text-xs text-gray-400 mt-1">Se autocompletará si el cliente existe</p>
          </div>

          <div>
            <InputLabel required>Teléfono</InputLabel>
            <input
              type="text"
              name="telefono"
              value={venta.telefono}
              onChange={handleChange}
              onBlur={handleBlurTelefono}
              placeholder="Ej: 3104567890"
              className="w-full"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Si el cliente existe, se autocompleta</p>
          </div>

          <div>
            <InputLabel>Correo electrónico</InputLabel>
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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <SectionIcon number="2" />
          <h2 className="text-lg font-semibold text-gray-900">Detalles del Servicio</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <InputLabel required>Plataforma o servicio</InputLabel>
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
            <InputLabel required>Cantidad de pantallas</InputLabel>
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
            <InputLabel required>Fecha de inicio</InputLabel>
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
            <InputLabel required>Duración (días)</InputLabel>
            <input
              type="number"
              name="diasServicio"
              value={venta.diasServicio}
              onChange={handleChange}
              className="w-full"
              min="1"
              placeholder="Ej: 30"
              required
            />
          </div>

          {/* Selector de cuentas propias — solo si hay plataforma y permisos */}
          {permisos.puedeGestionarCuentas && venta.plataforma && (
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tus cuentas disponibles
              </label>
              <SelectorCuenta
                proveedor={venta.plataforma}
                onCuentaSelected={handleCuentaSelected}
              />
              {cuentaId && perfilAsignado && (
                <div className="mt-3 flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Check size={16} className="text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-indigo-900">
                      {venta.plataforma} — {perfilAsignado}
                    </p>
                    <p className="text-xs text-indigo-600">
                      Costo: ${costoPorPerfil.toLocaleString()} por perfil
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Perfil y PIN — siempre visibles para datos manuales */}
          <div className="flex gap-4 md:col-span-2">
            <div className="flex-1">
              <InputLabel>Perfil</InputLabel>
              <input
                type="text"
                name="perfil"
                value={venta.perfil}
                onChange={handleChange}
                placeholder="Principal"
                className="w-full"
              />
              <p className="text-xs text-gray-400 mt-1">Opcional — se autocompleta si elegís una cuenta tuya</p>
            </div>
            <div className="flex-1">
              <InputLabel>PIN del perfil</InputLabel>
              <input
                type="text"
                name="pinPerfil"
                value={venta.pinPerfil}
                onChange={handleChange}
                placeholder="1234"
                className="w-full"
                maxLength={10}
              />
              <p className="text-xs text-gray-400 mt-1">Opcional</p>
            </div>
          </div>
        </div>

        {/* Fecha de venta */}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-5 py-4">
          <div>
            <p className="font-medium text-gray-700">La venta fue otro día</p>
            <p className="text-sm text-gray-400">Si estás cargando una venta anterior, marcá esta opción</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={mostrarFechaVenta}
              onChange={handleToggleFechaVenta}
              className="sr-only peer"
              aria-label="La venta fue otro día"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-indigo-600"></div>
          </label>
        </div>

        {mostrarFechaVenta && (
          <div>
            <InputLabel>Fecha de la venta</InputLabel>
            <input
              type="date"
              name="fechaVenta"
              value={venta.fechaVenta}
              onChange={handleChange}
              className="w-full"
            />
            <p className="text-xs text-gray-400 mt-1">Fecha real en que se realizó la venta</p>
          </div>
        )}
      </div>

      {/* =========================
          3. Valores Financieros
      ========================== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <SectionIcon number="3" />
          <h2 className="text-lg font-semibold text-gray-900">Valores Financieros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <InputLabel required>Precio de venta (por pantalla)</InputLabel>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
              <input
                type="number"
                name="precioVenta"
                value={venta.precioVenta}
                onChange={handleChange}
                className="w-full pl-7"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>

          <div>
            <InputLabel required>Costo del servicio</InputLabel>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
              <input
                type="number"
                name="costoServicio"
                value={venta.costoServicio}
                onChange={handleChange}
                className="w-full pl-7"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>
        </div>

        {/* Utilidad calculada */}
        <div className="bg-indigo-50 rounded-xl px-5 py-4 border border-indigo-100">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-indigo-600">Utilidad estimada</p>
            <p className="text-2xl font-bold text-indigo-700">
              ${utilidad.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <p className="text-xs text-indigo-400 mt-1">
            (Pantallas × Precio) - Costo
          </p>
        </div>
      </div>

      {/* =========================
          Estado de Pago
      ========================== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <SectionIcon number="$" />
          <h2 className="text-lg font-semibold text-gray-900">Estado de Pago</h2>
        </div>

        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-5 py-4">
          <div>
            <p className="font-medium text-gray-700">Pagó completo</p>
            <p className="text-sm text-gray-400">El cliente ya pagó el total del servicio</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="pagado"
              checked={venta.pagado}
              onChange={handleChange}
              className="sr-only peer"
              aria-label="Pagó completo"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-indigo-600"></div>
          </label>
        </div>

        {!venta.pagado && (
          <div>
            <InputLabel required>Saldo pendiente</InputLabel>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
              <input
                type="number"
                name="saldoPendiente"
                value={venta.saldoPendiente}
                onChange={handleChange}
                className="w-full pl-7"
                min="0"
                step="0.01"
                placeholder="0.00"
                required={!venta.pagado}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Monto que el cliente aún debe pagar</p>
          </div>
        )}
      </div>

      {/* =========================
          Botón de Envío
      ========================== */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold text-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Registrando...' : 'Registrar Venta'}
      </button>

    </form>
  );
}
