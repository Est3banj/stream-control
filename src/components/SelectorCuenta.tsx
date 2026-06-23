import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useCuentas, { crearCuenta } from '../hooks/useCuentas';
import usePermisos from '../hooks/usePermisos';
import type { Cuenta, PerfilCuenta } from '../types/cuenta';
import { Plus, X, Check, Save, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface SelectorCuentaProps {
  proveedor: string;
  onCuentaSelected: (cuentaId: string | null, perfilNombre: string | null, perfilPin: string | null, costoPorPerfil: number) => void;
  initialCuentaId?: string;
  initialPerfil?: string;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const maskedLocal = local.length > 2
    ? local.slice(0, 2) + '*'.repeat(Math.min(local.length - 2, 4))
    : local[0] + '*';
  const parts = domain.split('.');
  const maskedDomain = parts[0].length > 2
    ? parts[0].slice(0, 2) + '*'.repeat(Math.min(parts[0].length - 2, 4))
    : parts[0][0] + '*';
  return `${maskedLocal}@${maskedDomain}.${parts.slice(1).join('.')}`;
}

function calcularCostoPorPerfil(cuenta: Cuenta): number {
  if (cuenta.tipoVenta === 'completa') return cuenta.costo;
  const perfiles = Array.isArray(cuenta.perfiles) ? cuenta.perfiles : [];
  const perfilesDisponibles = perfiles.filter(p => p.estado === 'disponible').length;
  return perfilesDisponibles > 0 ? cuenta.costo / perfiles.length : cuenta.costo;
}

export default function SelectorCuenta({ proveedor, onCuentaSelected, initialCuentaId, initialPerfil }: SelectorCuentaProps) {
  const { user } = useAuth();
  const permisos = usePermisos(user);
  const { cuentas, loading } = useCuentas(user);

  const cuentasDisponibles = useMemo(() => {
    if (!proveedor) return [];
    return cuentas.filter(
      c => c.proveedor.toLowerCase() === proveedor.toLowerCase()
        && c.estado === 'disponible'
        && (c.tipoVenta === 'completa' || (Array.isArray(c.perfiles) ? c.perfiles : []).some(p => p.estado === 'disponible'))
    );
  }, [cuentas, proveedor]);

  const [modo, setModo] = useState<'existente' | 'nueva'>('existente');
  const [cuentaSeleccionadaId, setCuentaSeleccionadaId] = useState(initialCuentaId || '');
  const [perfilSeleccionado, setPerfilSeleccionado] = useState(initialPerfil || '');
  const [submitting, setSubmitting] = useState(false);

  const [nuevaCorreo, setNuevaCorreo] = useState('');
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [nuevaCosto, setNuevaCosto] = useState(0);
  const [nuevaPerfiles, setNuevaPerfiles] = useState<Array<{ nombre: string; pin: string }>>([{ nombre: '', pin: '' }]);

  useEffect(() => {
    setCuentaSeleccionadaId(initialCuentaId || '');
    setPerfilSeleccionado(initialPerfil || '');
    setModo('existente');
  }, [proveedor, initialCuentaId, initialPerfil]);

  const cuentaSeleccionada = useMemo(() => {
    if (!cuentaSeleccionadaId) return null;
    return cuentasDisponibles.find(c => c.id === cuentaSeleccionadaId)
      || cuentas.find(c => c.id === cuentaSeleccionadaId);
  }, [cuentasDisponibles, cuentas, cuentaSeleccionadaId]);

  const perfilesDisponibles = useMemo(() => {
    if (!cuentaSeleccionada) return [];
    if (cuentaSeleccionada.tipoVenta === 'completa') return [];
    return (Array.isArray(cuentaSeleccionada.perfiles) ? cuentaSeleccionada.perfiles : []).filter(p => p.estado === 'disponible');
  }, [cuentaSeleccionada]);

  useEffect(() => {
    if (!cuentaSeleccionada) {
      onCuentaSelected(null, null, null, 0);
      return;
    }
    // Cuenta completa — se asigna entera, sin perfil específico
    if (cuentaSeleccionada.tipoVenta === 'completa') {
      const costo = calcularCostoPorPerfil(cuentaSeleccionada);
      onCuentaSelected(cuentaSeleccionada.id, null, null, costo);
      return;
    }
    if (!perfilSeleccionado) {
      onCuentaSelected(null, null, null, 0);
      return;
    }
    const perfil = (Array.isArray(cuentaSeleccionada.perfiles) ? cuentaSeleccionada.perfiles : []).find(p => p.nombre === perfilSeleccionado);
    const costo = calcularCostoPorPerfil(cuentaSeleccionada);
    onCuentaSelected(cuentaSeleccionada.id, perfilSeleccionado, perfil?.pin || null, costo);
  }, [cuentaSeleccionadaId, perfilSeleccionado, cuentaSeleccionada]);

  if (!proveedor || !permisos.puedeGestionarCuentas) return null;

  const cambiarModo = (nuevo: 'existente' | 'nueva') => {
    setModo(nuevo);
    if (nuevo === 'existente') {
      setCuentaSeleccionadaId(initialCuentaId || '');
      setPerfilSeleccionado(initialPerfil || '');
    }
  };

  const agregarPerfilForm = () => {
    setNuevaPerfiles([...nuevaPerfiles, { nombre: '', pin: '' }]);
  };

  const eliminarPerfilForm = (idx: number) => {
    if (nuevaPerfiles.length <= 1) return;
    setNuevaPerfiles(nuevaPerfiles.filter((_, i) => i !== idx));
  };

  const actualizarPerfilForm = (idx: number, field: 'nombre' | 'pin', value: string) => {
    const updated = [...nuevaPerfiles];
    updated[idx] = { ...updated[idx], [field]: value };
    setNuevaPerfiles(updated);
  };

  const guardarCuentaNueva = async () => {
    if (!user) return;
    if (!nuevaCorreo.trim()) return toast.error('El correo de la cuenta es obligatorio');
    if (nuevaCosto <= 0) return toast.error('El costo debe ser mayor a 0');
    if (nuevaPerfiles.some(p => !p.nombre.trim())) return toast.error('Todos los perfiles deben tener un nombre');

    setSubmitting(true);
    try {
      const cuentaId = await crearCuenta({
        propietarioId: user.uid!,
        proveedor,
        correoCuenta: nuevaCorreo.trim(),
        costo: nuevaCosto,
        tipoVenta: 'perfiles',
        perfiles: nuevaPerfiles.map(p => ({
          nombre: p.nombre.trim(),
          pin: p.pin.trim(),
          estado: 'disponible' as const,
        })),
        estado: 'disponible',
      });

      setCuentaSeleccionadaId(cuentaId);
      setPerfilSeleccionado(nuevaPerfiles[0].nombre.trim());

      setNuevaCorreo('');
      setNuevaContrasena('');
      setNuevaCosto(0);
      setNuevaPerfiles([{ nombre: '', pin: '' }]);
      setModo('existente');

      toast.success('Cuenta registrada correctamente');
    } catch (err) {
      console.error('Error creando cuenta:', err);
      toast.error('Error al registrar la cuenta');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="modoCuenta"
            checked={modo === 'existente'}
            onChange={() => cambiarModo('existente')}
            className="text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm font-medium text-gray-700">Usar cuenta existente</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="modoCuenta"
            checked={modo === 'nueva'}
            onChange={() => cambiarModo('nueva')}
            className="text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm font-medium text-gray-700">Registrar cuenta nueva</span>
        </label>
      </div>

      {modo === 'existente' && (
        <div className="space-y-4">
          {cuentasDisponibles.length === 0 ? (
            loading ? (
              <div className="space-y-3">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-10 bg-gray-200 rounded-xl animate-pulse" />
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No hay cuentas disponibles para este proveedor
              </p>
            )
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Seleccionar cuenta</label>
                <select
                  value={cuentaSeleccionadaId}
                  onChange={e => {
                    setCuentaSeleccionadaId(e.target.value);
                    setPerfilSeleccionado('');
                  }}
                  className="w-full"
                >
                  <option value="">Seleccioná una cuenta...</option>
                  {cuentasDisponibles.map(c => (
                    <option key={c.id} value={c.id}>
                      {maskEmail(c.correoCuenta)} — ${c.costo.toLocaleString()} 
                      {c.tipoVenta === 'completa' 
                        ? ' (Completa)' 
                        : ` (${(Array.isArray(c.perfiles) ? c.perfiles : []).filter(p => p.estado === 'disponible').length}/${(Array.isArray(c.perfiles) ? c.perfiles : []).length} perfiles)`
                      }
                    </option>
                  ))}
                </select>
              </div>

              {cuentaSeleccionada && perfilesDisponibles.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">Seleccionar perfil</label>
                  <select
                    value={perfilSeleccionado}
                    onChange={e => setPerfilSeleccionado(e.target.value)}
                    className="w-full"
                  >
                    <option value="">Seleccioná un perfil...</option>
                    {perfilesDisponibles.map(p => (
                      <option key={p.nombre} value={p.nombre}>
                        {p.nombre}{p.pin ? ` — PIN: ${p.pin}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(cuentaSeleccionada && (perfilSeleccionado || cuentaSeleccionada.tipoVenta === 'completa')) && (
                <div className="bg-indigo-50 rounded-xl px-4 py-3 border border-indigo-100">
                  <p className="text-sm text-indigo-700">
                    <span className="font-medium">
                      {cuentaSeleccionada.tipoVenta === 'completa' ? 'Costo total:' : 'Costo por perfil:'}
                    </span>{' '}
                    ${calcularCostoPorPerfil(cuentaSeleccionada).toLocaleString()}
                  </p>
                  <p className="text-xs text-indigo-500 mt-1">
                    {cuentaSeleccionada.tipoVenta === 'completa'
                      ? 'Cuenta completa — costo total'
                      : `${(Array.isArray(cuentaSeleccionada.perfiles) ? cuentaSeleccionada.perfiles : []).length} perfiles — costo prorrateado`
                    }
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {modo === 'nueva' && (
        <div className="space-y-4 bg-gray-50 rounded-xl p-4 border border-gray-200">
          <p className="text-sm font-medium text-gray-700">Registrar nueva cuenta de {proveedor}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Correo de la cuenta *</label>
              <input
                type="email"
                value={nuevaCorreo}
                onChange={e => setNuevaCorreo(e.target.value)}
                placeholder="cuenta@email.com"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Contraseña</label>
              <input
                type="password"
                value={nuevaContrasena}
                onChange={e => setNuevaContrasena(e.target.value)}
                placeholder="Opcional"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Costo total *</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                <input
                  type="number"
                  value={nuevaCosto}
                  onChange={e => setNuevaCosto(Number(e.target.value))}
                  className="w-full pl-7"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-600">Perfiles</label>
              <button
                type="button"
                onClick={agregarPerfilForm}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
              >
                <Plus size={14} />
                Agregar perfil
              </button>
            </div>
            <div className="space-y-2">
              {nuevaPerfiles.map((p, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={p.nombre}
                      onChange={e => actualizarPerfilForm(idx, 'nombre', e.target.value)}
                      placeholder={`Perfil ${idx + 1}`}
                      className="w-full"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={p.pin}
                      onChange={e => actualizarPerfilForm(idx, 'pin', e.target.value)}
                      placeholder="PIN (opcional)"
                      className="w-full"
                      maxLength={10}
                    />
                  </div>
                  {nuevaPerfiles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => eliminarPerfilForm(idx)}
                      className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={guardarCuentaNueva}
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold text-sm hover:from-indigo-700 hover:to-indigo-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={16} />
                Guardar cuenta y seleccionar
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
