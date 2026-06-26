import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection, addDoc, setDoc, doc, serverTimestamp, getDoc,
  increment, updateDoc, query, where, getDocs, writeBatch,
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import usePermisos from '../hooks/usePermisos';
import useCuentas from '../hooks/useCuentas';
import SelectorCuenta from '../components/SelectorCuenta';
import { Check, Plus, X, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import type { VentaInput } from '../types/venta';

// ─── Types ───────────────────────────────────────────────────────────────

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
  perfiles: Array<{ nombre: string; pin: string }>;
  pagado: boolean;
  saldoPendiente: string;
}

interface ServicioItem {
  id: string;
  plataforma: string;
  correo: string;
  pantallas: number;
  precioVenta: number;
  costoServicio: number;
  fechaInicio: string;
  diasServicio: string;
  perfiles: Array<{ nombre: string; pin: string }>;
  cuentaId: string | null;
  perfilNombre: string | null;
  perfilPin: string | null;
  costoPorPerfil: number;
}

interface VentasFormProps {
  initialData?: Partial<VentaFormState>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const uid = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2);

function crearServicioVacio(): ServicioItem {
  return {
    id: uid(),
    plataforma: '',
    correo: '',
    pantallas: 1,
    precioVenta: 0,
    costoServicio: 0,
    fechaInicio: '',
    diasServicio: '',
    perfiles: [{ nombre: '', pin: '' }],
    cuentaId: null,
    perfilNombre: null,
    perfilPin: null,
    costoPorPerfil: 0,
  };
}

// ─── Servicios predeterminados ───────────────────────────────────────────

const SERVICIOS_PREDETERMINADOS = [
  'Netflix', 'Disney premium', 'Prime video', 'HBO Max',
  'Crunchyroll', 'MagisTV', 'Plex', 'PornHub',
  'IPTV', 'Vix plus', 'Universal', 'Paramount+',
  'Canva Premium', 'ChatGPT', 'Spotify Premium',
];

/** Input con datalist: tipeás y te filtra los servicios disponibles */
function ComboboxServicio({
  value,
  onChange,
  name,
  placeholder,
  required,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  name?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const listId = `servicios-datalist-${name || 'default'}`;
  return (
    <>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder || 'Buscá o escribí un servicio...'}
        list={listId}
        className="w-full"
        required={required}
        autoComplete="off"
      />
      <datalist id={listId}>
        {SERVICIOS_PREDETERMINADOS.map(s => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}

// ─── Component ───────────────────────────────────────────────────────────

export default function VentasForm({ initialData }: VentasFormProps) {
  const { user } = useAuth();
  const permisos = usePermisos(user);
  const { cuentas } = useCuentas(user);

  // ─── Single-service state (backward compatible) ───
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
    perfiles: initialData?.perfiles ?? [{ nombre: '', pin: '' }],
    pagado: initialData?.pagado ?? true,
    saldoPendiente: initialData?.saldoPendiente ?? '',
  });

  useEffect(() => {
    if (initialData) setVenta(prev => ({ ...prev, ...initialData }));
  }, [initialData]);

  // Sync perfiles[] con cantidad de pantallas
  const prevPantallas = React.useRef(venta.pantallas);
  useEffect(() => {
    const count = Number(venta.pantallas) || 1;
    if (count === prevPantallas.current) return;
    prevPantallas.current = count;
    setVenta(prev => {
      const p = prev.perfiles;
      if (p.length === count) return prev;
      if (p.length < count)
        return { ...prev, perfiles: [...p, ...Array(count - p.length).fill({ nombre: '', pin: '' })] };
      return { ...prev, perfiles: p.slice(0, count) };
    });
  }, [venta.pantallas]);

  // ─── Multi-service state ───
  const [modoCombinado, setModoCombinado] = useState(false);
  const [servicios, setServicios] = useState<ServicioItem[]>([crearServicioVacio()]);

  // ─── Shared state ───
  const [utilidad, setUtilidad] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [perfilAsignado, setPerfilAsignado] = useState<string | null>(null);
  const [perfilPinSeleccionado, setPerfilPinSeleccionado] = useState<string | null>(null);
  const [costoPorPerfil, setCostoPorPerfil] = useState<number>(0);

  // ─── Utility calculations ───
  useEffect(() => {
    const p = Number(venta.precioVenta) || 0;
    const c = Number(venta.costoServicio) || 0;
    const pant = Number(venta.pantallas) || 0;
    const cp = costoPorPerfil || 0;
    setUtilidad((pant * p) - (cp || c));
  }, [venta.precioVenta, venta.costoServicio, venta.pantallas, costoPorPerfil]);

  const utilidadMulti = servicios.reduce((sum, s) => {
    const pant = Number(s.pantallas) || 0;
    const pv = Number(s.precioVenta) || 0;
    const cs = Number(s.costoServicio) || 0;
    return sum + (pant * pv) - cs;
  }, 0);

  const totalMulti = servicios.reduce((sum, s) => {
    return sum + (Number(s.pantallas) || 0) * (Number(s.precioVenta) || 0);
  }, 0);

  const serviciosCompletos = servicios.filter(s => s.plataforma.trim());
  const cantServicios = serviciosCompletos.length;

  const servicioActualValido = !!(
    venta.nombre.trim() && venta.telefono.trim() && venta.plataforma.trim() &&
    venta.fechaInicio.trim() && venta.diasServicio && Number(venta.diasServicio) > 0
  );

  // ─── Handlers (single) ───
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, value, checked } = e.target;
    setVenta({ ...venta, [name]: type === 'checkbox' ? checked : value } as VentaFormState);
  };

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
    } catch { console.error('Error cargando cliente'); }
  };

  const handleBlurTelefono = async () => {
    if (!user || !venta.telefono.trim()) return;
    try {
      const q = query(
        collection(db, 'clientes'),
        where('propietarioId', '==', user.uid),
        where('telefono', '==', venta.telefono.trim()),
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
    } catch { console.error('Error buscando por teléfono'); }
  };

  const handleCuentaSelected = (
    newCuentaId: string | null, newPerfilNombre: string | null,
    newPerfilPin: string | null, newCostoPorPerfil: number,
  ) => {
    setCuentaId(newCuentaId);
    setCostoPorPerfil(newCostoPorPerfil);

    if (!newCuentaId) {
      setPerfilAsignado(null);
      setPerfilPinSeleccionado(null);
      return;
    }

    const cuenta = cuentas.find(c => c.id === newCuentaId);
    if (!cuenta) {
      console.warn('⚠️ [handleCuentaSelected] Cuenta no encontrada en useCuentas:', { newCuentaId, cuentasCount: cuentas.length, cuentas });
      return;
    }

    setVenta(prev => ({
      ...prev,
      correo: cuenta.correoCuenta || prev.correo,
      costoServicio: newCostoPorPerfil || prev.costoServicio,
      perfiles: cuenta.tipoVenta !== 'completa'
        ? prev.perfiles.map((_, i) => {
            const disp = (cuenta.perfiles || []).filter(p => p.estado === 'disponible');
            return disp[i] ? { nombre: disp[i].nombre, pin: disp[i].pin } : { nombre: '', pin: '' };
          })
        : prev.perfiles,
    }));

    setPerfilAsignado(newPerfilNombre);
    setPerfilPinSeleccionado(newPerfilPin);
  };

  // ─── Handlers (multi) ───
  const handleServicioChange = (id: string, field: keyof ServicioItem, value: string | number | Array<{ nombre: string; pin: string }>) => {
    setServicios(prev => prev.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, [field]: value };

      // Sync perfiles length when pantallas changes
      if (field === 'pantallas') {
        const count = Number(value) || 1;
        const p = s.perfiles;
        updated.perfiles = p.length === count ? p
          : p.length < count
            ? [...p, ...Array(count - p.length).fill({ nombre: '', pin: '' })]
            : p.slice(0, count);
      }

      return updated;
    }));
  };

  const agregarServicio = () => {
    setServicios(prev => [...prev, crearServicioVacio()]);
  };

  const eliminarServicio = (id: string) => {
    setServicios(prev => prev.length > 1 ? prev.filter(s => s.id !== id) : prev);
  };

  const toggleModoCombinado = () => {
    setModoCombinado(prev => !prev);
    if (!modoCombinado) {
      // Reset multi state when turning ON
      setServicios([crearServicioVacio()]);
    }
  };

  const handleServicioCuentaSelected = (
    servicioId: string,
    newCuentaId: string | null,
    _newPerfilNombre: string | null,
    _newPerfilPin: string | null,
    newCostoPorPerfil: number,
  ) => {
    setServicios(prev => prev.map(s => {
      if (s.id !== servicioId) return s;

      if (!newCuentaId) return {
        ...s, cuentaId: null, perfilNombre: null, perfilPin: null, costoPorPerfil: 0,
      };

      const cuenta = cuentas.find(c => c.id === newCuentaId);
      if (!cuenta) {
        console.warn('⚠️ [handleServicioCuentaSelected] Cuenta no encontrada:', { newCuentaId, cuentasCount: cuentas.length, servicioId: s.id });
        return { ...s, cuentaId: newCuentaId, costoPorPerfil: newCostoPorPerfil };
      }

      const disp = (cuenta.perfiles || []).filter(p => p.estado === 'disponible');

      return {
        ...s,
        cuentaId: newCuentaId,
        correo: cuenta.correoCuenta || s.correo,
        costoServicio: newCostoPorPerfil || s.costoServicio,
        costoPorPerfil: newCostoPorPerfil,
        perfiles: cuenta.tipoVenta !== 'completa'
          ? s.perfiles.map((_, i) =>
              disp[i] ? { nombre: disp[i].nombre, pin: disp[i].pin } : { nombre: '', pin: '' }
            )
          : s.perfiles,
      };
    }));
  };

  // ─── Validation helpers ───
  const validarSimple = (): string | null => {
    if (!venta.nombre.trim()) return 'El nombre del cliente es obligatorio.';
    if (!venta.telefono.trim()) return 'El teléfono es obligatorio.';
    if (!venta.plataforma.trim()) return 'La plataforma o servicio es obligatorio.';
    if (!venta.fechaInicio.trim()) return 'La fecha de inicio es obligatoria.';
    if (!venta.diasServicio || isNaN(venta.diasServicio as unknown as number) || Number(venta.diasServicio) <= 0)
      return 'La duración del servicio debe ser válida.';
    if (!venta.pantallas || isNaN(venta.pantallas) || Number(venta.pantallas) < 1)
      return 'La cantidad de pantallas debe ser válida.';
    if (venta.precioVenta === 0 || isNaN(venta.precioVenta) || Number(venta.precioVenta) < 0)
      return 'El precio de venta debe ser válido.';
    if (venta.costoServicio === 0 || isNaN(venta.costoServicio) || Number(venta.costoServicio) < 0)
      return 'El costo del servicio debe ser válido.';
    if (!venta.pagado && (venta.saldoPendiente === '' || isNaN(venta.saldoPendiente as unknown as number) || Number(venta.saldoPendiente) <= 0))
      return 'Indicá el saldo pendiente cuando el pago está incompleto.';
    if (venta.telefono && !/^\d+$/.test(venta.telefono.trim()))
      return 'El teléfono solo debe contener números.';
    if (venta.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(venta.correo.trim()))
      return 'El correo electrónico no es válido.';
    return null;
  };

  const validarMulti = (): string | null => {
    if (!venta.nombre.trim()) return 'El nombre del cliente es obligatorio.';
    if (!venta.telefono.trim()) return 'El teléfono es obligatorio.';
    if (venta.telefono && !/^\d+$/.test(venta.telefono.trim()))
      return 'El teléfono solo debe contener números.';
    if (servicios.length === 0) return 'Agregá al menos un servicio.';

    for (const s of servicios) {
      if (!s.plataforma.trim()) return 'Cada servicio debe tener una plataforma.';
      if (!s.fechaInicio.trim()) return 'Cada servicio debe tener una fecha de inicio.';
      if (!s.diasServicio || isNaN(Number(s.diasServicio)) || Number(s.diasServicio) <= 0)
        return 'Cada servicio debe tener una duración válida.';
      if (Number(s.pantallas) < 1) return 'Cada servicio debe tener al menos 1 pantalla.';
      if (Number(s.precioVenta) <= 0) return 'Cada servicio debe tener un precio de venta.';
      if (Number(s.costoServicio) < 0) return 'El costo del servicio no puede ser negativo.';
    }

    if (!venta.pagado && (venta.saldoPendiente === '' || isNaN(Number(venta.saldoPendiente)) || Number(venta.saldoPendiente) <= 0))
      return 'Indicá el saldo pendiente cuando el pago está incompleto.';
    if (venta.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(venta.correo.trim()))
      return 'El correo electrónico no es válido.';

    return null;
  };

  // ─── Submit: Simple (backward compatible) ───
  const handleSubmitSimple = async () => {
    if (!user) { toast.error('Error: Usuario no autenticado.'); return; }

    const err = validarSimple();
    if (err) { toast.error(err); return; }

    // Duplicate phone check
    try {
      const dupQuery = query(
        collection(db, 'clientes'),
        where('propietarioId', '==', user.uid),
        where('telefono', '==', venta.telefono.trim()),
      );
      const dupSnap = await getDocs(dupQuery);
      if (!dupSnap.empty) {
        const existingName = dupSnap.docs[0].data().nombre as string;
        if (existingName !== venta.nombre.trim())
          return toast.error(`El teléfono ${venta.telefono} ya está registrado con "${existingName}". Usá otro teléfono o editá el cliente existente.`);
      }
    } catch { console.warn('No se pudo verificar teléfono duplicado'); }

    // Hard-block: cliente limit
    if (permisos.clienteLimit !== Infinity) {
      try {
        const countQuery = query(collection(db, 'clientes'), where('propietarioId', '==', user.uid));
        const countSnap = await getDocs(countQuery);
        if (countSnap.size >= permisos.clienteLimit)
          return toast.error(`Alcanzaste el límite de ${permisos.clienteLimit} clientes del plan Starter. Actualizá a Professional para clientes ilimitados.`);
      } catch { console.warn('No se pudo verificar límite de clientes'); }
    }

    setSubmitting(true);
    try {
      const fechaInicioDate = new Date(venta.fechaInicio);
      const dias = Number(venta.diasServicio);
      const fechaVencimientoDate = new Date(fechaInicioDate);
      fechaVencimientoDate.setDate(fechaVencimientoDate.getDate() + dias);
      const fechaVencimiento = fechaVencimientoDate.toISOString().split('T')[0];

      const perfilesValidos = venta.perfiles.filter(p => p.nombre || p.pin);
      const nuevaVenta: VentaInput = {
        ...venta,
        perfil: perfilesValidos[0]?.nombre || '',
        pinPerfil: perfilesValidos[0]?.pin || '',
        perfiles: perfilesValidos,
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

      await addDoc(collection(db, 'ventas'), nuevaVenta);

      // Cliente
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
      await setDoc(clienteRef, clienteData, { merge: true });

      // Saldo pendiente
      if (!venta.pagado) {
        await updateDoc(clienteRef, {
          saldoPendiente: increment(Number(venta.saldoPendiente)),
        });
      }

      // Movimiento
      const montoTotal = Number(venta.pantallas) * Number(venta.precioVenta);
      await addDoc(collection(db, 'movimientos'), {
        tipo: 'Ingreso',
        monto: montoTotal,
        descripcion: `Venta de ${venta.plataforma} (${venta.pantallas} pantallas)`,
        fecha: serverTimestamp(),
        propietarioId: user.uid,
        usuarioEmail: user.email,
      });

      // Marcar perfil en cuenta
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
        } catch { console.warn('⚠️ No se pudo marcar el perfil como asignado'); }
      }

      toast.success('Venta registrada correctamente');

      // Reset
      setVenta({
        nombre: '', telefono: '', correo: '', plataforma: '', pantallas: 1,
        precioVenta: 0, costoServicio: 0, fechaInicio: '', diasServicio: '',
        fechaVenta: getToday(), perfiles: [{ nombre: '', pin: '' }], pagado: true, saldoPendiente: '',
      });
      setUtilidad(0);
      setCuentaId(null);
      setPerfilAsignado(null);
      setPerfilPinSeleccionado(null);
      setCostoPorPerfil(0);

    } catch (error) {
      console.error('❌ Error al registrar la venta:', error);
      toast.error('Error al registrar la venta. Inténtelo nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Submit: Multi-service ───
  const handleSubmitMulti = async () => {
    if (!user) { toast.error('Error: Usuario no autenticado.'); return; }

    const err = validarMulti();
    if (err) { toast.error(err); return; }

    const serviciosValidos = servicios.filter(s => s.plataforma.trim() && Number(s.precioVenta) > 0);

    setSubmitting(true);
    const grupoId = uid();

    try {
      const batch = writeBatch(db);

      const fechaVencimientos: string[] = [];

      for (const s of serviciosValidos) {
        const fechaInicioDate = new Date(s.fechaInicio);
        const dias = Number(s.diasServicio);
        const fechaVencDate = new Date(fechaInicioDate);
        fechaVencDate.setDate(fechaVencDate.getDate() + dias);
        const fechaVenc = fechaVencDate.toISOString().split('T')[0];
        fechaVencimientos.push(fechaVenc);

        const perfilesValidos = s.perfiles.filter(p => p.nombre || p.pin);
        const ventaRef = doc(collection(db, 'ventas'));
        batch.set(ventaRef, {
          nombre: venta.nombre,
          telefono: venta.telefono,
          correo: s.correo || '',
          plataforma: s.plataforma,
          pantallas: Number(s.pantallas),
          precioVenta: Number(s.precioVenta),
          costoServicio: Number(s.costoServicio),
          utilidad: (Number(s.pantallas) * Number(s.precioVenta)) - Number(s.costoServicio),
          fechaInicio: s.fechaInicio,
          diasServicio: Number(s.diasServicio),
          fechaVenta: venta.fechaVenta,
          perfil: perfilesValidos[0]?.nombre || '',
          pinPerfil: perfilesValidos[0]?.pin || '',
          perfiles: perfilesValidos,
          ...(s.cuentaId ? { cuentaId: s.cuentaId } : {}),
          ...(s.perfilNombre ? { perfilNombre: s.perfilNombre } : {}),
          ...(s.perfilPin ? { perfilPin: s.perfilPin } : {}),
          ...(s.costoPorPerfil ? { costoPorPerfil: s.costoPorPerfil } : {}),
          pagado: venta.pagado,
          saldoPendiente: venta.pagado ? 0 : Number(venta.saldoPendiente || 0),
          fechaRegistro: serverTimestamp(),
          fechaRegistroSistema: null,
          propietarioId: user.uid!,
          usuarioEmail: user.email!,
          fechaVencimiento: fechaVenc,
          grupoId,
        });
      }

      await batch.commit();

      // Cliente (usar última fechaVencimiento como referencia)
      const ultimaFechaVenc = fechaVencimientos.sort().pop() || '';
      const clienteRef = doc(db, 'clientes', `${user.uid}_${venta.nombre}`);
      await setDoc(clienteRef, {
        nombre: venta.nombre,
        telefono: venta.telefono,
        correo: venta.correo,
        estado: 'activo',
        plataforma: serviciosValidos.map(s => s.plataforma).join(', '),
        propietarioId: user.uid,
        usuarioEmail: user.email,
        fechaVencimiento: ultimaFechaVenc,
      }, { merge: true });

      // Saldo pendiente
      if (!venta.pagado) {
        await updateDoc(clienteRef, {
          saldoPendiente: increment(Number(venta.saldoPendiente)),
        });
      }

      // Movimiento (total combinado)
      await addDoc(collection(db, 'movimientos'), {
        tipo: 'Ingreso',
        monto: totalMulti,
        descripcion: `Venta combinada: ${serviciosValidos.map(s => s.plataforma).join(' + ')}`,
        fecha: serverTimestamp(),
        propietarioId: user.uid,
        usuarioEmail: user.email,
      });

      toast.success(`Venta combinada registrada (${serviciosValidos.length} servicios)`);

      // Reset
      setVenta({
        nombre: '', telefono: '', correo: '', plataforma: '', pantallas: 1,
        precioVenta: 0, costoServicio: 0, fechaInicio: '', diasServicio: '',
        fechaVenta: getToday(), perfiles: [{ nombre: '', pin: '' }], pagado: true, saldoPendiente: '',
      });
      setServicios([crearServicioVacio()]);

    } catch (error) {
      console.error('❌ Error al registrar venta combinada:', error);
      toast.error('Error al registrar la venta combinada. Inténtelo nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Main submit ───
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (modoCombinado) {
      if (servicios.some(s => s.plataforma.trim())) {
        await handleSubmitMulti();
      } else {
        toast.error('Completá al menos un servicio o desactivá el modo combinado.');
      }
    } else {
      await handleSubmitSimple();
    }
  };

  // ─── Render helpers ───
  const InputLabel = ({ children, required = false }: { children: React.ReactNode; required?: boolean }) => (
    <label className="block text-xs font-medium text-gray-500 mb-0.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );

  const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
    <div className="flex items-center gap-1.5 pb-1.5 mb-2 border-b border-gray-100">
      <Icon size={14} className="text-indigo-500" />
      <h2 className="text-xs font-bold text-gray-800">{title}</h2>
    </div>
  );

  const renderServicioCard = (s: ServicioItem, index: number) => (
    <div
      key={s.id}
      className="border-l-2 border-indigo-200 pl-2.5 space-y-1.5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-indigo-600">
          Servicio #{index + 1}
        </span>
        {servicios.length > 1 && (
          <button
            type="button"
            onClick={() => eliminarServicio(s.id)}
            className="p-0.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Eliminar servicio"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="col-span-2 sm:col-span-4">
          <InputLabel required>Plataforma</InputLabel>
          <ComboboxServicio
            value={s.plataforma}
            onChange={e => handleServicioChange(s.id, 'plataforma', e.target.value)}
            placeholder="Ej: Netflix, Disney+..."
            required
          />
        </div>

        {/* Selector de cuentas */}
        {permisos.puedeGestionarCuentas && s.plataforma && (
          <div className="col-span-2 sm:col-span-4 -mt-1 mb-0.5">
            <SelectorCuenta
              proveedor={s.plataforma}
              onCuentaSelected={(cuentaId, perfilNombre, perfilPin, costo) =>
                handleServicioCuentaSelected(s.id, cuentaId, perfilNombre, perfilPin, costo)
              }
            />
            {s.cuentaId && s.perfiles.some(p => p.nombre) && (
              <div className="mt-1 flex items-center gap-1.5 px-2 py-1 bg-indigo-50 rounded border border-indigo-100">
                <Check size={11} className="text-indigo-600 shrink-0" />
                <span className="text-xs text-indigo-700">
                  {s.plataforma} — ${s.costoPorPerfil.toLocaleString()}/perfil
                </span>
              </div>
            )}
          </div>
        )}

        <div className="col-span-2 sm:col-span-4">
          <InputLabel>Correo del servicio</InputLabel>
          <input
            type="email"
            value={s.correo}
            onChange={e => handleServicioChange(s.id, 'correo', e.target.value)}
            placeholder="email de la cuenta (Netflix...)"
            className="w-full text-sm"
          />
        </div>

        <div>
          <InputLabel required>Pantallas</InputLabel>
          <input
            type="number"
            value={s.pantallas}
            onChange={e => handleServicioChange(s.id, 'pantallas', Number(e.target.value))}
            className="w-full text-sm"
            min="1"
          />
        </div>

        <div>
          <InputLabel required>Fecha inicio</InputLabel>
          <input
            type="date"
            value={s.fechaInicio}
            onChange={e => handleServicioChange(s.id, 'fechaInicio', e.target.value)}
            className="w-full text-sm"
          />
        </div>

        <div>
          <InputLabel required>Duración (días)</InputLabel>
          <input
            type="number"
            value={s.diasServicio}
            onChange={e => handleServicioChange(s.id, 'diasServicio', e.target.value)}
            className="w-full text-sm"
            min="1"
            placeholder="30"
          />
        </div>

        <div>
          <InputLabel required>Precio venta</InputLabel>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
            <input
              type="number"
              value={s.precioVenta}
              onChange={e => handleServicioChange(s.id, 'precioVenta', Number(e.target.value))}
              className="w-full pl-4 text-sm"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div>
          <InputLabel required>Costo servicio</InputLabel>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
            <input
              type="number"
              value={s.costoServicio}
              onChange={e => handleServicioChange(s.id, 'costoServicio', Number(e.target.value))}
              className="w-full pl-4 text-sm"
              min="0"
              step="0.01"
            />
          </div>
        </div>
      </div>

      {/* Perfiles dinámicos por pantalla */}
      <div className="pt-0.5 space-y-1">
        {Array.from({ length: s.pantallas }, (_, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <InputLabel>Perfil {s.pantallas > 1 ? `#${i + 1}` : ''}</InputLabel>
              <input
                type="text"
                value={s.perfiles[i]?.nombre || ''}
                onChange={e => {
                  const p = [...s.perfiles];
                  p[i] = { ...p[i], nombre: e.target.value };
                  handleServicioChange(s.id, 'perfiles', p);
                }}
                placeholder="Principal"
                className="w-full text-sm"
              />
            </div>
            <div>
              <InputLabel>PIN {s.pantallas > 1 ? `#${i + 1}` : ''}</InputLabel>
              <input
                type="text"
                value={s.perfiles[i]?.pin || ''}
                onChange={e => {
                  const p = [...s.perfiles];
                  p[i] = { ...p[i], pin: e.target.value };
                  handleServicioChange(s.id, 'perfiles', p);
                }}
                placeholder="1234"
                className="w-full text-sm"
                maxLength={10}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── JSX ───────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-4">

      {/* ═══════ Cliente ═══════ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
        <SectionHeader icon={Layers} title="Cliente" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <InputLabel required>Nombre</InputLabel>
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
          </div>
        </div>
      </div>

      {/* ═══════ Servicio(s) ═══════ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <Layers size={14} className="text-indigo-500" />
            <h2 className="text-xs font-bold text-gray-800">
              {modoCombinado ? 'Servicios' : 'Servicio'}
            </h2>
            {modoCombinado && cantServicios > 0 && (
              <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-1.5 py-0.5 rounded-full">
                {cantServicios}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={toggleModoCombinado}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-all ${
              modoCombinado
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {modoCombinado ? 'Combinado ON' : 'Combinado OFF'}
          </button>
        </div>

        {!modoCombinado ? (
          /* ─── SINGLE SERVICE ─── */
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="sm:col-span-2">
                <InputLabel required>Plataforma o servicio</InputLabel>
                <ComboboxServicio
                  name="plataforma"
                  value={venta.plataforma}
                  onChange={handleChange}
                  placeholder="Ej: Netflix, Disney+, Spotify..."
                  required
                />
              </div>

              <div>
                <InputLabel>Correo del servicio</InputLabel>
                <input
                  type="email"
                  name="correo"
                  value={venta.correo}
                  onChange={handleChange}
                  placeholder="email de la cuenta (Netflix...)"
                  className="w-full"
                />
              </div>

              {/* Selector de cuentas — justo después de elegir plataforma */}
              {permisos.puedeGestionarCuentas && venta.plataforma && (
                <div className="sm:col-span-2">
                  <SelectorCuenta
                    proveedor={venta.plataforma}
                    onCuentaSelected={handleCuentaSelected}
                  />
                  {cuentaId && venta.perfiles.some(p => p.nombre) && (
                    <div className="mt-1 flex items-center gap-1.5 px-2 py-1 bg-indigo-50 rounded border border-indigo-100">
                      <Check size={11} className="text-indigo-600 shrink-0" />
                      <span className="text-xs text-indigo-700">
                        {venta.plataforma} — ${costoPorPerfil.toLocaleString()}/perfil
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <InputLabel required>Pantallas</InputLabel>
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
                <InputLabel required>Fecha inicio</InputLabel>
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

              <div>
                <InputLabel required>Precio venta (por pantalla)</InputLabel>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
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

            {/* Utilidad */}
            <div className="flex items-center justify-between bg-indigo-50/80 rounded-lg px-3 py-2 border border-indigo-100">
              <span className="text-xs font-semibold text-indigo-600">Utilidad estimada</span>
              <span className="text-base font-bold text-indigo-700">
                ${utilidad.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* Perfiles dinámicos por pantalla */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500">
                Perfiles por pantalla {venta.pantallas > 1 && `(${venta.pantallas})`}
              </p>
              {Array.from({ length: venta.pantallas }, (_, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <InputLabel>Perfil {venta.pantallas > 1 ? `#${i + 1}` : ''}</InputLabel>
                    <input
                      type="text"
                      value={venta.perfiles[i]?.nombre || ''}
                      onChange={e => {
                        const p = [...venta.perfiles];
                        p[i] = { ...p[i], nombre: e.target.value };
                        setVenta({ ...venta, perfiles: p });
                      }}
                      placeholder="Principal"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <InputLabel>PIN {venta.pantallas > 1 ? `#${i + 1}` : ''}</InputLabel>
                    <input
                      type="text"
                      value={venta.perfiles[i]?.pin || ''}
                      onChange={e => {
                        const p = [...venta.perfiles];
                        p[i] = { ...p[i], pin: e.target.value };
                        setVenta({ ...venta, perfiles: p });
                      }}
                      placeholder="1234"
                      className="w-full"
                      maxLength={10}
                    />
                  </div>
                </div>
              ))}
            </div>

          </div>
        ) : (
          /* ─── MULTI SERVICE ─── */
          <div className="space-y-2">
            {servicios.map((s, i) => renderServicioCard(s, i))}

            <button
              type="button"
              onClick={agregarServicio}
              className="w-full py-2 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              Agregar otro servicio
            </button>

            {servicios.some(s => Number(s.precioVenta) > 0) && (
              <div className="bg-indigo-50/80 rounded-lg px-3 py-2 border border-indigo-100 space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Ingreso total</span>
                  <span className="font-bold text-gray-900">${totalMulti.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Utilidad estimada</span>
                  <span className="font-bold text-indigo-700">${utilidadMulti.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════ Pago ═══════ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
        <SectionHeader icon={Layers} title="Estado de Pago" />

        <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
          <div>
            <p className="text-sm font-medium text-gray-700">Pagó completo</p>
            <p className="text-xs text-gray-400">El cliente ya pagó el total del servicio</p>
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
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-indigo-600" />
          </label>
        </div>

        {!venta.pagado && (
          <div className="mt-3">
            <InputLabel required>Saldo pendiente</InputLabel>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
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
          </div>
        )}
      </div>

      {/* ═══════ Botón ═══════ */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold text-base shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting
          ? 'Registrando...'
          : modoCombinado && cantServicios > 0
            ? `Registrar Venta Combinada (${cantServicios} servicios)`
            : 'Registrar Venta'
        }
      </button>

    </form>
  );
}
