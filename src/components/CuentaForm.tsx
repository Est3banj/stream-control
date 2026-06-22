import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Calendar } from 'lucide-react';
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
  const [correoCuenta, setCorreoCuenta] = useState(initialData?.correoCuenta || '');
  const [contrasena, setContrasena] = useState('');
  const [costo, setCosto] = useState(initialData?.costo?.toString() || '');
  const [tipoVenta, setTipoVenta] = useState<'perfiles' | 'completa'>(initialData?.tipoVenta || 'perfiles');
  const [estado, setEstado] = useState<'disponible' | 'asignada' | 'expirada'>(initialData?.estado || 'disponible');
  const [perfiles, setPerfiles] = useState<{ nombre: string; pin: string }[]>(
    initialData?.perfiles?.map(p => ({ nombre: p.nombre, pin: p.pin })) || [{ nombre: '', pin: '' }]
  );
  const [otroProveedor, setOtroProveedor] = useState('');
  const [fechaInicio, setFechaInicio] = useState(initialData?.fechaInicio || '');
  const [diasServicio, setDiasServicio] = useState(initialData?.diasServicio?.toString() || '');

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

    if (!proveedorActual.trim()) {
      toast.error('El proveedor es obligatorio');
      return;
    }
    if (!isEdit && !correoCuenta.trim()) {
      toast.error('El correo de la cuenta es obligatorio');
      return;
    }
    if (!isEdit && !contrasena.trim()) {
      toast.error('La contraseña es obligatoria');
      return;
    }
    if (!costo || Number(costo) <= 0) {
      toast.error('El costo debe ser mayor a 0');
      return;
    }
    if (tipoVenta === 'perfiles') {
      const validos = perfiles.filter(p => p.nombre.trim());
      if (validos.length === 0) {
        toast.error('Agregá al menos un perfil con nombre');
        return;
      }
    }

    const perfilesData: PerfilCuenta[] = tipoVenta === 'perfiles'
      ? perfiles.filter(p => p.nombre.trim()).map(p => ({
          nombre: p.nombre.trim(),
          pin: p.pin.trim(),
          estado: 'disponible' as const,
        }))
      : [];

    const fechaVencimiento = fechaVencimientoCal || undefined;
    const fechaInicioVal = fechaInicio || undefined;
    const diasServicioVal = diasServicio ? Number(diasServicio) : undefined;

    if (isEdit) {
      await onSubmit({
        costo: Number(costo),
        estado,
        perfiles: perfilesData,
        fechaInicio: fechaInicioVal,
        diasServicio: diasServicioVal,
        fechaVencimiento,
      });
    } else {
      await onSubmit({
        propietarioId: '',
        proveedor: proveedorActual.trim(),
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
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Proveedor */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Proveedor <span className="text-red-500">*</span>
        </label>
        <select
          value={proveedor}
          onChange={(e) => setProveedor(e.target.value)}
          className="w-full"
          required
          disabled={isEdit}
        >
          <option value="">Seleccionar proveedor...</option>
          {PROVEEDORES.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {proveedor === 'Otro' && (
          <input
            type="text"
            value={otroProveedor}
            onChange={(e) => setOtroProveedor(e.target.value)}
            placeholder="Nombre del proveedor"
            className="w-full mt-2"
            required
            disabled={isEdit}
          />
        )}
      </div>

      {/* Credenciales — solo en creación */}
      {!isEdit && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Credenciales</h3>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Correo de la cuenta <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={correoCuenta}
              onChange={(e) => setCorreoCuenta(e.target.value)}
              className="w-full"
              placeholder="netflix@ejemplo.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Contraseña <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              className="w-full"
              placeholder="Contraseña de la cuenta"
              required
            />
          </div>
        </div>
      )}

      {/* Costo */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Costo de la cuenta <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="number"
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            className="w-full pl-8"
            min="0"
            step="100"
            placeholder="0"
            required
          />
        </div>
      </div>

      {/* Período del Servicio */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Período del Servicio</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Fecha de inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Duración (días)
            </label>
            <input
              type="number"
              value={diasServicio}
              onChange={(e) => setDiasServicio(e.target.value)}
              className="w-full"
              min="1"
              placeholder="Ej: 30"
            />
          </div>
        </div>
        {fechaVencimientoCal && (
          <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
            <span className="text-sm font-medium text-indigo-600">Fecha de vencimiento</span>
            <span className="text-sm font-bold text-indigo-700">{fechaVencimientoCal}</span>
          </div>
        )}
      </div>

      {/* Tipo de venta */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">Tipo de venta</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="tipoVenta"
              value="perfiles"
              checked={tipoVenta === 'perfiles'}
              onChange={() => setTipoVenta('perfiles')}
              className="w-4 h-4 text-indigo-600"
            />
            <span className="text-sm font-medium text-gray-700">Perfiles</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="tipoVenta"
              value="completa"
              checked={tipoVenta === 'completa'}
              onChange={() => setTipoVenta('completa')}
              className="w-4 h-4 text-indigo-600"
            />
            <span className="text-sm font-medium text-gray-700">Completa</span>
          </label>
        </div>
      </div>

      {/* Perfiles — solo si tipoVenta === 'perfiles' */}
      {tipoVenta === 'perfiles' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-gray-700">Perfiles</label>
            <button
              type="button"
              onClick={agregarPerfil}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              <Plus size={16} />
              Agregar perfil
            </button>
          </div>
          {perfiles.map((perfil, idx) => (
            <div key={idx} className="flex gap-2 items-start p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex-1">
                <input
                  type="text"
                  value={perfil.nombre}
                  onChange={(e) => actualizarPerfil(idx, 'nombre', e.target.value)}
                  placeholder="Nombre del perfil"
                  className="w-full"
                />
              </div>
              <div className="w-24">
                <input
                  type="text"
                  value={perfil.pin}
                  onChange={(e) => actualizarPerfil(idx, 'pin', e.target.value)}
                  placeholder="PIN"
                  className="w-full"
                />
              </div>
              {perfiles.length > 1 && (
                <button
                  type="button"
                  onClick={() => quitarPerfil(idx)}
                  className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Estado — solo en edición */}
      {isEdit && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Estado</label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as 'disponible' | 'asignada' | 'expirada')}
            className="w-full"
          >
            <option value="disponible">Disponible</option>
            <option value="asignada">Asignada</option>
            <option value="expirada">Expirada</option>
          </select>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-3 pt-4 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1" disabled={loading}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={loading}>
          {loading ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Guardar Cuenta'}
        </button>
      </div>
    </form>
  );
}
