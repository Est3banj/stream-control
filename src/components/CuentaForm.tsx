import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Calendar, Eye, EyeOff } from 'lucide-react';
import type { Cuenta, PerfilCuenta, CreateCuentaInput } from '../types/cuenta';

const PROVEEDORES = ['Netflix', 'Max', 'Disney+', 'Prime Video', 'ChatGPT', 'Win Sports+', 'Universal+', 'Paramount+', 'Otro'];

interface CuentaFormProps {
  initialData?: Cuenta;
  onSubmit: (data: CreateCuentaInput | Partial<Cuenta>) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function CuentaForm({ initialData, onSubmit, onCancel, loading }: CuentaFormProps) {
  const isEdit = !!initialData;
  const [proveedor, setProveedor] = useState(initialData?.proveedor || '');
  const [nombreProveedor, setNombreProveedor] = useState(initialData?.nombreProveedor || '');
  const [correoCuenta, setCorreoCuenta] = useState(initialData?.correoCuenta || '');
  const [contrasena, setContrasena] = useState('');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [costo, setCosto] = useState(initialData?.costo?.toString() || '');

  const [estado, setEstado] = useState<'disponible' | 'asignada' | 'expirada'>(initialData?.estado || 'disponible');
  const [tipoVenta, setTipoVenta] = useState<'perfiles' | 'completa'>(initialData?.tipoVenta || 'perfiles');
  const [perfiles, setPerfiles] = useState<{ nombre: string; pin: string }[]>(
    Array.isArray(initialData?.perfiles)
      ? initialData.perfiles.map(p => ({ nombre: p.nombre, pin: p.pin }))
      : [{ nombre: '', pin: '' }]
  );
  const [otroProveedor, setOtroProveedor] = useState('');
  const [fechaInicio, setFechaInicio] = useState(initialData?.fechaInicio || '');
  const [diasServicio, setDiasServicio] = useState(initialData?.diasServicio?.toString() || '');
  const [submitting, setSubmitting] = useState(false);

  const proveedorActual = proveedor === 'Otro' ? otroProveedor : proveedor;

  const fechaVencimientoCal = useMemo(() => {
    if (!fechaInicio || !diasServicio) return '';
    const d = new Date(fechaInicio);
    d.setDate(d.getDate() + Number(diasServicio));
    return d.toISOString().split('T')[0];
  }, [fechaInicio, diasServicio]);

  const agregarPerfil = () => {
    setPerfiles([...perfiles, { nombre: '', pin: '' }]);
  };

  const quitarPerfil = (idx: number) => {
    setPerfiles(perfiles.filter((_, i) => i !== idx));
  };

  const actualizarPerfil = (idx: number, field: 'nombre' | 'pin', value: string) => {
    setPerfiles(perfiles.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (!proveedorActual.trim()) {
      toast.error('La plataforma es obligatoria');
      setSubmitting(false);
      return;
    }
    if (!isEdit && !correoCuenta.trim()) {
      toast.error('El correo de la cuenta es obligatorio');
      setSubmitting(false);
      return;
    }
    if (!isEdit && !contrasena.trim()) {
      toast.error('La contraseña es obligatoria');
      setSubmitting(false);
      return;
    }
    if (!costo || Number(costo) <= 0) {
      toast.error('El costo debe ser mayor a 0');
      setSubmitting(false);
      return;
    }
    const validos = perfiles.filter(p => p.nombre.trim());
    if (validos.length === 0) {
      toast.error('Agregá al menos un perfil con nombre');
      setSubmitting(false);
      return;
    }

    const perfilesData: PerfilCuenta[] = validos.map(p => {
      // Si es edición, buscar perfil original por nombre para preservar asignaciones activas
      if (isEdit && initialData?.perfiles) {
        const original = initialData.perfiles.find(op => op.nombre === p.nombre.trim());
        if (original && original.estado === 'asignado') {
          return {
            nombre: p.nombre.trim(),
            pin: p.pin.trim(),
            estado: original.estado,
            clienteNombre: original.clienteNombre,
            fechaAsignacion: original.fechaAsignacion,
          };
        }
      }
      return {
        nombre: p.nombre.trim(),
        pin: p.pin.trim(),
        estado: 'disponible' as const,
      };
    });

    const fechaVencimiento = fechaVencimientoCal || undefined;
    const fechaInicioVal = fechaInicio || undefined;
    const diasServicioVal = diasServicio ? Number(diasServicio) : undefined;
    const nombreProveedorVal = nombreProveedor.trim() || undefined;

    if (isEdit) {
      await onSubmit({
        nombreProveedor: nombreProveedorVal,
        costo: Number(costo),
        estado,
        tipoVenta,
        perfiles: perfilesData,
        fechaInicio: fechaInicioVal,
        diasServicio: diasServicioVal,
        fechaVencimiento,
      });
    } else {
      await onSubmit({
        propietarioId: '',
        proveedor: proveedorActual.trim(),
        nombreProveedor: nombreProveedorVal,
        correoCuenta: correoCuenta.trim(),
        contrasena: contrasena.trim(),
        costo: Number(costo),
        tipoVenta,
        perfiles: perfilesData,
        estado: 'disponible' as const,
        fechaInicio: fechaInicioVal,
        diasServicio: diasServicioVal,
        fechaVencimiento,
      } as CreateCuentaInput & { contrasena: string; fechaInicio?: string; diasServicio?: number; fechaVencimiento?: string });
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-slate-100">
      {/* Plataforma / Servicio */}
      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1.5">
          Plataforma / Servicio <span className="text-rose-400">*</span>
        </label>
        <select
          value={proveedor}
          onChange={(e) => setProveedor(e.target.value)}
          className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 transition-all duration-150 appearance-none cursor-pointer"
          required
          disabled={isEdit}
        >
          <option value="">Seleccionar plataforma...</option>
          {PROVEEDORES.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {proveedor === 'Otro' && (
          <input
            type="text"
            value={otroProveedor}
            onChange={(e) => setOtroProveedor(e.target.value)}
            placeholder="Nombre de la plataforma"
            className="w-full mt-2 h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 placeholder:text-slate-500/70 placeholder:font-normal caret-cyan-400 transition-all duration-150"
            required
            disabled={isEdit}
          />
        )}
      </div>

      {/* Nombre del Proveedor (Mayorista) */}
      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1.5">
          Nombre del Proveedor (Mayorista)
        </label>
        <input
          type="text"
          value={nombreProveedor}
          onChange={(e) => setNombreProveedor(e.target.value)}
          placeholder="Ej: Pedro Cuentas, Distribuidor XYZ (opcional)"
          className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 placeholder:text-slate-500/70 placeholder:font-normal caret-cyan-400 transition-all duration-150"
        />
      </div>

      {/* Tipo de venta */}
      <div>
        <label className="block text-xs font-medium text-slate-300 mb-2">
          Tipo de venta <span className="text-rose-400">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTipoVenta('perfiles')}
            className={`p-4 rounded-xl border text-left transition-all ${
              tipoVenta === 'perfiles'
                ? 'border-cyan-500/60 bg-indigo-950/40 shadow-lg shadow-indigo-950/40'
                : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
            }`}
          >
            <p className="font-semibold text-white">Por perfiles</p>
            <p className="text-sm text-slate-400 mt-1">Vendé cada perfil por separado</p>
          </button>
          <button
            type="button"
            onClick={() => setTipoVenta('completa')}
            className={`p-4 rounded-xl border text-left transition-all ${
              tipoVenta === 'completa'
                ? 'border-cyan-500/60 bg-indigo-950/40 shadow-lg shadow-indigo-950/40'
                : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
            }`}
          >
            <p className="font-semibold text-white">Completa</p>
            <p className="text-sm text-slate-400 mt-1">Vendé la cuenta completa</p>
          </button>
        </div>
      </div>

      {/* Credenciales — solo en creación */}
      {!isEdit && (
        <div className="space-y-4 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Credenciales</h3>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Correo de la cuenta <span className="text-rose-400">*</span>
            </label>
            <input
              type="email"
              value={correoCuenta}
              onChange={(e) => setCorreoCuenta(e.target.value)}
              className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 placeholder:text-slate-500/70 placeholder:font-normal caret-cyan-400 transition-all duration-150 font-mono"
              placeholder="netflix@ejemplo.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Contraseña <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type={mostrarContrasena ? 'text' : 'password'}
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                className="w-full h-11 pl-4 pr-12 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 placeholder:text-slate-500/70 placeholder:font-normal caret-cyan-400 transition-all duration-150 font-mono"
                placeholder="Contraseña de la cuenta"
                required
              />
              <button
                type="button"
                onClick={() => setMostrarContrasena(!mostrarContrasena)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                tabIndex={-1}
              >
                {mostrarContrasena ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Costo */}
      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1.5">
          Costo de la cuenta <span className="text-rose-400">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm pointer-events-none">$</span>
          <input
            type="number"
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            className="w-full h-11 pl-8 pr-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 placeholder:text-slate-500/70 placeholder:font-normal caret-cyan-400 transition-all duration-150"
            min="0"
            step="100"
            placeholder="0"
            required
          />
        </div>
      </div>

      {/* Período del Servicio */}
      <div className="space-y-4 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-indigo-400" />
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Período del Servicio</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Fecha de inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 transition-all duration-150"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Duración (días)
            </label>
            <input
              type="number"
              value={diasServicio}
              onChange={(e) => setDiasServicio(e.target.value)}
              className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 placeholder:text-slate-500/70 placeholder:font-normal caret-cyan-400 transition-all duration-150"
              min="1"
              placeholder="Ej: 30"
            />
          </div>
        </div>
        {fechaVencimientoCal && (
          <div className="flex items-center justify-between px-3 py-2 bg-indigo-950/40 rounded-xl border border-indigo-800/40">
            <span className="text-xs font-medium text-indigo-300">Fecha de vencimiento</span>
            <span className="text-xs font-bold text-cyan-300">{fechaVencimientoCal}</span>
          </div>
        )}
      </div>

      {/* Perfiles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium text-slate-300">Perfiles</label>
          <button
            type="button"
            onClick={agregarPerfil}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
          >
            <Plus size={14} />
            Agregar perfil
          </button>
        </div>
        {perfiles.map((perfil, idx) => (
          <div key={idx} className="flex gap-2 items-start p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="flex-1">
              <input
                type="text"
                value={perfil.nombre}
                onChange={(e) => actualizarPerfil(idx, 'nombre', e.target.value)}
                placeholder="Nombre del perfil"
                className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 placeholder:text-slate-500/70 placeholder:font-normal caret-cyan-400 transition-all duration-150"
              />
            </div>
            <div className="w-28">
              <input
                type="text"
                value={perfil.pin}
                onChange={(e) => actualizarPerfil(idx, 'pin', e.target.value)}
                placeholder="PIN"
                className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 placeholder:text-slate-500/70 placeholder:font-normal caret-cyan-400 transition-all duration-150 font-mono"
              />
            </div>
            {perfiles.length > 1 && (
              <button
                type="button"
                onClick={() => quitarPerfil(idx)}
                className="p-2.5 rounded-xl text-rose-400 hover:bg-rose-950/40 transition-colors border border-transparent hover:border-rose-800/40"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Estado — solo en edición */}
      {isEdit && (
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">Estado</label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as 'disponible' | 'asignada' | 'expirada')}
            className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 transition-all duration-150 appearance-none cursor-pointer"
          >
            <option value="disponible">Disponible</option>
            <option value="asignada">Asignada</option>
            <option value="expirada">Expirada</option>
          </select>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-3 pt-4 border-t border-slate-800">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1" disabled={loading || submitting}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading || submitting}>
          {loading || submitting ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Guardar Cuenta'}
        </button>
      </div>
    </form>
  );
}
