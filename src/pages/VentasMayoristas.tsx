import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useCuentas from '../hooks/useCuentas';
import useTokens, { revocarToken, reactivarToken } from '../hooks/useTokens';
import usePermisos from '../hooks/usePermisos';
import FeatureBlocked from '../components/FeatureBlocked';
import { callFunction } from '../lib/apiClient';
import { useMoneda } from '../hooks/useMoneda';
import {
  Copy, Loader2, Monitor, Calendar, X, RefreshCw,
  PlusCircle, List, Check, TrendingUp, Users, ShieldAlert,
} from 'lucide-react';
import DropdownMenu from '../components/DropdownMenu';
import toast from 'react-hot-toast';

export default function VentasMayoristas() {
  const { user } = useAuth();
  const { cuentas } = useCuentas(user);
  const { tokens } = useTokens(user);
  const permisos = usePermisos(user);
  const { formatear } = useMoneda();

  const [tab, setTab] = useState<'nueva' | 'activas'>('nueva');
  const [cuentaId, setCuentaId] = useState('');
  const [diasAcceso, setDiasAcceso] = useState(30);
  const [linkGenerado, setLinkGenerado] = useState('');
  const [linkExpira, setLinkExpira] = useState('');
  const [totalRecibido, setTotalRecibido] = useState(0);
  const [cantidad, setCantidad] = useState(1);
  const [nombreSub, setNombreSub] = useState('');
  const [perfilesSeleccionados, setPerfilesSeleccionados] = useState<number[]>([]);
  const [generando, setGenerando] = useState(false);
  const selectCuentaRef = React.useRef<HTMLSelectElement>(null);

  const cuentasConIMAP = useMemo(() =>
    cuentas.filter(c => c.estado !== 'expirada'),
  [cuentas]);

  const cuentaSeleccionada = cuentas.find(c => c.id === cuentaId);

  const costoServicio = useMemo(() => {
    if (!cuentaSeleccionada) return 0;
    const perfiles = Array.isArray(cuentaSeleccionada.perfiles) ? cuentaSeleccionada.perfiles : [];
    return perfiles.length > 0
      ? Math.round(cuentaSeleccionada.costo / perfiles.length)
      : cuentaSeleccionada.costo;
  }, [cuentaSeleccionada]);

  const totalCosto = costoServicio * cantidad;
  const precioPorPerfil = cantidad > 0 ? Math.round(totalRecibido / cantidad) : 0;
  const utilidad = totalRecibido - totalCosto;

  // Tokens para mayoristas / sub-distribuidores (sin clienteId asociado)
  const tokensMayoristas = useMemo(() =>
    tokens
      .filter(t => !t.clienteId)
      .sort((a, b) => new Date(b.createdAt as unknown as string).getTime() - new Date(a.createdAt as unknown as string).getTime()),
  [tokens]);

  const totalLinks = tokensMayoristas.length;
  const linksActivos = tokensMayoristas.filter(t => t.activo && new Date(t.expiraEn) >= new Date()).length;
  const linksVencidos = tokensMayoristas.filter(t => !t.activo || new Date(t.expiraEn) < new Date()).length;

  const handleGenerarLink = async () => {
    if (!cuentaId) {
      toast.error('Seleccioná una cuenta');
      selectCuentaRef.current?.focus();
      return;
    }
    if (!nombreSub.trim()) {
      toast.error('Ingresá el nombre del revendedor o sub-distribuidor');
      return;
    }
    if (perfilesSeleccionados.length === 0) {
      toast.error('Seleccioná al menos un perfil para la venta mayorista');
      return;
    }

    setGenerando(true);
    setLinkGenerado('');

    try {
      const expiraEn = new Date(Date.now() + diasAcceso * 24 * 60 * 60 * 1000).toISOString();
      const data = await callFunction<object, { url: string }>('generarTokenSubdistribuidor', {
        cuentaId,
        expiraEn,
        clienteNombre: nombreSub.trim(),
        cantidad,
        totalRecibido,
        precioPorPerfil,
        totalCosto,
        utilidad,
        diasAcceso,
        perfilesSeleccionados,
        proveedor: cuentaSeleccionada?.proveedor || '',
        costoServicio,
      });

      const url = `${window.location.origin}${data.url}`;
      setLinkGenerado(url);
      setLinkExpira(new Date(expiraEn).toLocaleDateString('es-CO'));
      toast.success('Venta mayorista registrada y link generado');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al generar link: ${message}`);
    } finally {
      setGenerando(false);
    }
  };

  const copiarLink = () => {
    if (!linkGenerado) return;
    navigator.clipboard.writeText(linkGenerado);
    toast.success('Link copiado al portapapeles');
  };

  if (!permisos.puedeGenerarTokens) {
    return (
      <div className="space-y-6 animate-fade-in text-slate-100">
        <div className="mb-6">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
            Ventas Mayoristas
          </h1>
          <p className="text-slate-400">Gestión de accesos y links para revendedores</p>
        </div>
        <FeatureBlocked
          feature="Ventas Mayoristas"
          description="Generá links de consulta y gestioná accesos por lotes para revendedores y sub-distribuidores."
          plan="Enterprise"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
          Ventas Mayoristas
        </h1>
        <p className="text-slate-400">Generá links de consulta y administrá accesos para revendedores</p>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 flex items-center gap-4 cursor-default">
          <div className="w-12 h-12 rounded-2xl bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Links</p>
            <p className="text-2xl font-bold text-white">{totalLinks}</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4 cursor-default">
          <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
            <Check size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Activos</p>
            <p className="text-2xl font-bold text-emerald-400">{linksActivos}</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4 cursor-default">
          <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800/40 flex items-center justify-center text-rose-400">
            <ShieldAlert size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Vencidos / Revocados</p>
            <p className="text-2xl font-bold text-rose-400">{linksVencidos}</p>
          </div>
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex gap-3 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setTab('nueva')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            tab === 'nueva'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/50'
              : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
          }`}
        >
          <PlusCircle size={18} />
          Nueva Venta Mayorista
        </button>
        <button
          type="button"
          onClick={() => setTab('activas')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            tab === 'activas'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/50'
              : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
          }`}
        >
          <List size={18} />
          Ventas Mayoristas Activas ({totalLinks})
        </button>
      </div>

      {/* Contenido Pestaña 1: Nueva Venta Mayorista */}
      {tab === 'nueva' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl p-6 space-y-6 text-slate-100">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Seleccionar cuenta <span className="text-rose-400">*</span>
            </label>
            <select
              ref={selectCuentaRef}
              value={cuentaId}
              onChange={e => {
                setCuentaId(e.target.value);
                setPerfilesSeleccionados([]);
                setCantidad(0);
                setLinkGenerado('');
              }}
              className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100"
            >
              <option value="">Seleccioná una cuenta...</option>
              {cuentasConIMAP.map(c => {
                const perfiles = Array.isArray(c.perfiles) ? c.perfiles : [];
                const disp = perfiles.filter(p => p.estado === 'disponible').length;
                return (
                  <option key={c.id} value={c.id}>
                    {c.proveedor} — {c.correoCuenta} ({disp}/{perfiles.length} perfiles disponibles)
                  </option>
                );
              })}
            </select>
          </div>

          {cuentaSeleccionada && (
            <div className="flex items-center gap-3 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
              <Monitor size={18} className="text-indigo-400" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{cuentaSeleccionada.proveedor}</p>
                <p className="text-xs text-slate-400">{cuentaSeleccionada.correoCuenta}</p>
              </div>
              <span className="text-sm font-bold text-cyan-300">{formatear(cuentaSeleccionada.costo || 0)}</span>
            </div>
          )}

          {/* Selector de perfiles */}
          {cuentaSeleccionada && (() => {
            const perfiles = Array.isArray(cuentaSeleccionada.perfiles) ? cuentaSeleccionada.perfiles : [];
            const disponibles = perfiles.filter(p => p.estado === 'disponible');
            if (disponibles.length === 0) {
              return (
                <div className="p-4 bg-amber-950/30 rounded-xl border border-amber-800/40">
                  <p className="text-sm text-amber-300 font-medium">No hay perfiles disponibles en esta cuenta</p>
                </div>
              );
            }
            return (
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Perfiles a vender ({disponibles.length} disponibles) <span className="text-rose-400">*</span>
                </label>
                <div className="space-y-2 max-h-56 overflow-y-auto p-1">
                  {disponibles.map(p => {
                    const idx = perfiles.indexOf(p);
                    const selected = perfilesSeleccionados.includes(idx);
                    return (
                      <label
                        key={idx}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          selected
                            ? 'border-indigo-500 bg-indigo-950/40 text-white'
                            : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            setPerfilesSeleccionados(prev => {
                              const next = selected
                                ? prev.filter(i => i !== idx)
                                : [...prev, idx];
                              setCantidad(next.length);
                              return next;
                            });
                          }}
                          className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700"
                        />
                        <span className="text-sm font-medium">{p.nombre}</span>
                        {p.pin && <span className="text-xs text-slate-400">PIN: {p.pin}</span>}
                      </label>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (perfilesSeleccionados.length === disponibles.length) {
                      setPerfilesSeleccionados([]);
                      setCantidad(0);
                    } else {
                      const todos = disponibles.map(p => perfiles.indexOf(p));
                      setPerfilesSeleccionados(todos);
                      setCantidad(todos.length);
                    }
                  }}
                  className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  {perfilesSeleccionados.length === disponibles.length
                    ? 'Deseleccionar todos'
                    : 'Seleccionar todos los disponibles'}
                </button>
              </div>
            );
          })()}

          {/* Datos del revendedor y valores financieros */}
          {cuentaSeleccionada && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Nombre del revendedor / sub-distribuidor <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={nombreSub}
                    onChange={e => setNombreSub(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100 placeholder-slate-500"
                    placeholder="Ej: Distribuidor Express, Juan Pérez"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Cantidad de perfiles
                  </label>
                  <input
                    type="number"
                    value={cantidad}
                    className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 font-semibold"
                    readOnly
                    min="1"
                  />
                  <p className="text-xs text-slate-400 mt-1">Calculado automáticamente según los perfiles seleccionados</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Total recibido $
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">$</span>
                    <input
                      type="number"
                      value={totalRecibido}
                      onChange={e => setTotalRecibido(Number(e.target.value))}
                      className="w-full pl-7 bg-slate-900/80 border border-slate-700/80 text-slate-100"
                      min="0"
                      step="100"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Costo total</label>
                  <div className="flex items-center h-[42px] px-4 bg-slate-950/60 rounded-xl border border-slate-800 text-sm font-semibold text-slate-300">
                    {formatear(totalCosto)}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Utilidad proyectada</label>
                  <div className={`flex items-center h-[42px] px-4 rounded-xl border text-sm font-bold ${
                    utilidad >= 0
                      ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400'
                      : 'bg-rose-950/40 border-rose-800/40 text-rose-400'
                  }`}>
                    {formatear(utilidad)}
                  </div>
                </div>
              </div>

              {totalRecibido > 0 && cantidad > 0 && (
                <p className="text-xs text-slate-400 text-right font-medium">
                  {formatear(totalRecibido)} ÷ {cantidad} = <span className="text-cyan-300 font-bold">{formatear(precioPorPerfil)}</span> x perfil
                </p>
              )}

              {/* Duración */}
              <div>
                <h2 className="text-sm font-semibold text-slate-300 mb-3">Duración del acceso</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[7, 15, 30, 60].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDiasAcceso(d)}
                      className={`p-3 rounded-xl text-center transition-all border text-sm font-semibold ${
                        diasAcceso === d
                          ? 'border-indigo-500 bg-indigo-950/50 text-white shadow-sm'
                          : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {d} días
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-300 font-medium">Personalizado:</span>
                  <input
                    type="number"
                    value={diasAcceso}
                    onChange={e => setDiasAcceso(Number(e.target.value))}
                    min="1"
                    max="365"
                    className="w-24 text-sm bg-slate-900/80 border border-slate-700/80 text-slate-100"
                  />
                  <span className="text-sm text-slate-400">días</span>
                </div>
              </div>

              {/* Botón de acción */}
              <button
                type="button"
                onClick={handleGenerarLink}
                disabled={generando || perfilesSeleccionados.length === 0}
                className="btn-primary w-full py-3.5 rounded-xl font-semibold shadow-lg shadow-indigo-950/50 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generando ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Generando venta mayorista...
                  </>
                ) : (
                  <>
                    <PlusCircle size={18} />
                    Registrar Venta Mayorista
                  </>
                )}
              </button>

              {/* Resultado del link */}
              {linkGenerado && (
                <div className="mt-6 space-y-3 animate-fade-in">
                  <div className="bg-indigo-950/40 rounded-2xl p-5 border border-indigo-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-indigo-300">Link de consulta generado</p>
                      <span className="inline-flex items-center gap-1.5 text-xs text-indigo-400 font-medium">
                        <Calendar size={14} /> Expira: {linkExpira}
                      </span>
                    </div>
                    <code className="block bg-slate-950/80 rounded-xl px-4 py-3 text-sm text-cyan-300 border border-slate-800 break-all font-mono select-all">
                      {linkGenerado}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={copiarLink}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <Copy size={18} />
                    Copiar link del revendedor
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Contenido Pestaña 2: Ventas Mayoristas Activas */}
      {tab === 'activas' && (
        <div className="bg-slate-900/80 rounded-2xl shadow-xl border border-slate-800 overflow-hidden text-slate-100">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-lg font-bold text-white">Links para revendedores y sub-distribuidores</h2>
          </div>

          {tokensMayoristas.length === 0 ? (
            <div className="p-12 text-center">
              <Users size={48} className="mx-auto mb-3 text-slate-700" />
              <p className="font-semibold text-slate-300">No hay links generados para mayoristas</p>
              <p className="text-sm text-slate-500 mt-1">Podés registrar una nueva venta mayorista desde la pestaña superior</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 uppercase tracking-wider text-xs">
                    <th className="px-6 py-3.5 text-left font-semibold">Revendedor</th>
                    <th className="px-6 py-3.5 text-left font-semibold">Plataforma</th>
                    <th className="px-6 py-3.5 text-center font-semibold">Estado</th>
                    <th className="px-6 py-3.5 text-right font-semibold">Expira</th>
                    <th className="px-6 py-3.5 text-center font-semibold">Token ID</th>
                    <th className="px-6 py-3.5 text-center font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tokensMayoristas.map(token => {
                    const expirado = new Date(token.expiraEn) < new Date();
                    const proveedor = token.cuentaId
                      ? cuentas.find(c => c.id === token.cuentaId)?.proveedor || '—'
                      : '—';

                    return (
                      <tr key={token.id} className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-semibold text-white">{token.clienteNombre || 'Sub-distribuidor'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-300">{proveedor}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            expirado
                              ? 'bg-rose-950/50 text-rose-400 border-rose-800/40'
                              : token.activo
                                ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {expirado ? 'Vencido' : token.activo ? 'Activo' : 'Revocado'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-400">
                          {new Date(token.expiraEn).toLocaleDateString('es-CO')}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <code className="text-xs text-indigo-400 font-mono bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-800/40">{token.id.slice(0, 8)}</code>
                        </td>
                        <td className="px-6 py-4">
                          <DropdownMenu
                            actions={[
                              {
                                label: 'Copiar link',
                                icon: <Copy size={16} />,
                                onClick: () => {
                                  const url = `${window.location.origin}/r/${token.id}`;
                                  navigator.clipboard.writeText(url);
                                  toast.success('Link copiado');
                                },
                              },
                              ...(token.activo && !expirado ? [{
                                label: 'Revocar acceso',
                                icon: <X size={16} />,
                                onClick: async () => {
                                  try {
                                    await revocarToken(token.id);
                                    toast.success('Token revocado correctamente');
                                  } catch {
                                    toast.error('Error al revocar token');
                                  }
                                },
                                variant: 'danger' as const,
                              }] : []),
                              ...(!token.activo || expirado ? [{
                                label: 'Reactivar acceso',
                                icon: <RefreshCw size={16} />,
                                onClick: async () => {
                                  try {
                                    await reactivarToken(token.id);
                                    toast.success('Token reactivado');
                                  } catch {
                                    toast.error('Error al reactivar token');
                                  }
                                },
                              }] : []),
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
