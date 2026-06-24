import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import useCuentas from '../hooks/useCuentas';
import useTokens, { revocarToken, reactivarToken } from '../hooks/useTokens';
import usePermisos from '../hooks/usePermisos';
import FeatureBlocked from '../components/FeatureBlocked';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Copy, Loader2, AlertCircle, Monitor, Calendar, X, RefreshCw, Search, Link, List } from 'lucide-react';
import { CASE_OPTIONS, CASE_LABELS } from '../components/CasoSelector';
import DropdownMenu from '../components/DropdownMenu';
import toast from 'react-hot-toast';

const PROVEEDOR_CASOS: Record<string, string[]> = {
  Netflix: ['viajenet', 'hogarnet', 'resetnet', 'ininet'],
  Win: ['wincode'],
  ChatGPT: ['cgptcode'],
  'Universal+': ['univer1'],
  Max: ['accmax'],
};

type Estado = 'idle' | 'consulting' | 'result' | 'error' | 'generating';

export default function ConsultaCodigos() {
  const { user } = useAuth();
  const { cuentas } = useCuentas(user);
  const { tokens } = useTokens(user);
  const permisos = usePermisos(user);

  const [cuentaId, setCuentaId] = useState('');
  const [selectedCaso, setSelectedCaso] = useState('');
  const [estado, setEstado] = useState<Estado>('idle');
  const [codigo, setCodigo] = useState('');
  const [email, setEmail] = useState('');
  const [fecha, setFecha] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Estado para generar link
  const [modo, setModo] = useState<'directo' | 'link' | 'links'>('directo');
  const [diasAcceso, setDiasAcceso] = useState(30);
  const [linkGenerado, setLinkGenerado] = useState('');
  const [linkExpira, setLinkExpira] = useState('');
  const [totalRecibido, setTotalRecibido] = useState(0);
  const [cantidad, setCantidad] = useState(1);
  const [nombreSub, setNombreSub] = useState('');
  const [perfilesSeleccionados, setPerfilesSeleccionados] = useState<number[]>([]);

  const cuentasConIMAP = useMemo(() =>
    cuentas.filter(c => c.estado !== 'expirada'),
  [cuentas]);

  const cuentaSeleccionada = cuentas.find(c => c.id === cuentaId);

  const proveedor = cuentaSeleccionada?.proveedor || '';
  const casosDisponibles = (PROVEEDOR_CASOS[proveedor] || [])
    .filter(c => c !== 'resetnet')
    .map(value => ({ value, label: CASE_LABELS[value] || value }));

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

  const consultarCodigo = async () => {
    if (!cuentaId || !selectedCaso) return;
    setEstado('consulting');
    setCodigo('');
    setErrorMsg('');

    try {
      const functions = getFunctions();
      const fn = httpsCallable(functions, 'consultarCodigoDirecto');
      const result = await fn({ cuentaId, caso: selectedCaso });
      const data = result.data as Record<string, unknown>;

      if (data.encontrado) {
        setCodigo(data.codigo as string);
        setEmail(data.email as string);
        setFecha(data.fecha as string);
        setEstado('result');
      } else {
        setEstado('idle');
        toast.error('Código no encontrado — verifica que haya sido enviado al correo');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setErrorMsg(message);
      setEstado('error');
    }
  };

  const generarLink = async () => {
    if (!cuentaId) return;
    setEstado('generating');
    setLinkGenerado('');

    try {
      const expiraEn = new Date(Date.now() + diasAcceso * 24 * 60 * 60 * 1000).toISOString();
      const functions = getFunctions();
      const fn = httpsCallable(functions, 'generarTokenSubdistribuidor');
      const result = await fn({ cuentaId, expiraEn, clienteNombre: nombreSub.trim() || 'Sub-distribuidor' });
      const data = result.data as Record<string, unknown>;

      const url = `${window.location.origin}${data.url}`;
      setLinkGenerado(url);
      setLinkExpira(new Date(expiraEn).toLocaleDateString('es-CO'));

      // 🟢 Registrar venta de cuenta/subdistribuidor
      if (totalRecibido > 0 && user) {
        try {
          await addDoc(collection(db, 'ventas'), {
            nombre: 'Sub-distribuidor',
            telefono: '0000000000',
            correo: '',
            plataforma: cuentaSeleccionada?.proveedor || '',
            pantallas: cantidad,
            precioVenta: precioPorPerfil,
            costoServicio: totalCosto,
            utilidad,
            fechaInicio: new Date().toISOString().split('T')[0],
            fechaVenta: new Date().toISOString().split('T')[0],
            diasServicio: diasAcceso,
            perfil: '',
            pinPerfil: '',
            pagado: true,
            saldoPendiente: 0,
            fechaRegistro: serverTimestamp(),
            fechaRegistroSistema: null,
            fechaVencimiento: new Date(expiraEn).toISOString().split('T')[0],
            propietarioId: user.uid!,
            usuarioEmail: user.email!,
            cuentaId,
            tokenGenerado: data.token as string,
            costoPorPerfil: costoServicio,
          });

          // 🟢 Registrar movimiento financiero
          await addDoc(collection(db, 'movimientos'), {
            tipo: 'Ingreso',
            monto: totalRecibido,
            descripcion: `Venta ${cantidad} perfil(es) ${cuentaSeleccionada?.proveedor || ''} (Sub-distribuidor)`,
            fecha: serverTimestamp(),
            propietarioId: user.uid,
            usuarioEmail: user.email,
          });
        } catch (err) {
            console.warn('⚠️ No se pudo registrar la venta:', err);
            toast.error('El link se generó pero la venta no quedó registrada en reportes');
          }
      }

      // 🟢 Marcar perfiles como asignados en la cuenta
      if (perfilesSeleccionados.length > 0) {
        try {
          const cuentaRef = doc(db, 'cuentas', cuentaId);
          const cuentaSnap = await getDoc(cuentaRef);
          if (cuentaSnap.exists()) {
            const perfiles = cuentaSnap.data().perfiles;
            if (Array.isArray(perfiles)) {
              const hoy = new Date().toISOString().split('T')[0];
              perfilesSeleccionados.forEach(idx => {
                if (idx >= 0 && idx < perfiles.length) {
                  perfiles[idx] = {
                    ...perfiles[idx],
                    estado: 'asignado',
                    clienteNombre: nombreSub.trim() || 'Sub-distribuidor',
                    fechaAsignacion: hoy,
                  };
                }
              });
              const quedanDisponibles = perfiles.some((p: { estado: string }) => p.estado === 'disponible');
              await updateDoc(cuentaRef, {
                perfiles,
                ...(quedanDisponibles ? {} : { estado: 'asignada' as const }),
                updatedAt: serverTimestamp(),
              });
            }
          }
        } catch (err) {
          console.warn('⚠️ No se pudieron marcar los perfiles como asignados:', err);
        }
      }

      setEstado('idle');
      toast.success('Link generado correctamente');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al generar link: ${message}`);
      setEstado('idle');
    }
  };

  const copiarLink = () => {
    navigator.clipboard.writeText(linkGenerado);
    toast.success('Link copiado al portapapeles');
  };

  if (!permisos.puedeGenerarTokens) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-700">
            Consulta de Códigos
          </h1>
          <p className="text-gray-600">Consultá códigos de verificación al instante</p>
        </div>
        <FeatureBlocked
          feature="Consulta de Códigos"
          description="Consultá códigos de verificación de tus cuentas de streaming al instante. Generá links para sub-distribuidores."
          plan="Enterprise"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-700">
          Consulta de Códigos
        </h1>
        <p className="text-gray-600">Consultá códigos de verificación al instante</p>
      </div>

      {/* Selector de modo */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setModo('directo')}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
              modo === 'directo'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Search size={18} />
            Consulta directa
          </button>
          <button
            onClick={() => setModo('link')}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
              modo === 'link'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Link size={18} />
            Generar link
          </button>
          <button
            onClick={() => setModo('links')}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
              modo === 'links'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <List size={18} />
            Links activos
          </button>
        </div>

        {/* Selector de cuenta */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Seleccionar cuenta</label>
          <select
            value={cuentaId}
            onChange={e => { setCuentaId(e.target.value); setSelectedCaso(''); setEstado('idle'); setLinkGenerado(''); }}
            className="w-full"
          >
            <option value="">Seleccioná una cuenta...</option>
            {cuentasConIMAP.map(c => (
              <option key={c.id} value={c.id}>
                {c.proveedor} — {c.correoCuenta}
              </option>
            ))}
          </select>
        </div>

        {cuentaId && (
          <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100 mb-4">
            <Monitor size={18} className="text-indigo-500" />
            <span className="text-sm font-semibold text-indigo-900">{cuentaSeleccionada?.proveedor}</span>
            <span className="text-xs text-indigo-500">—</span>
            <span className="text-sm text-indigo-700">{cuentaSeleccionada?.correoCuenta}</span>
          </div>
        )}
      </div>

      {modo === 'directo' && cuentaId && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tipo de código</h2>

          {casosDisponibles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {casosDisponibles.map((caso) => (
                <button
                  key={caso.value}
                  onClick={() => setSelectedCaso(caso.value)}
                  className={`p-3 rounded-xl text-left transition-all border text-sm ${
                    selectedCaso === caso.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300'
                  }`}
                >
                  {caso.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic mb-6">
              No hay códigos disponibles para este proveedor
            </p>
          )}

          <button
            onClick={consultarCodigo}
            disabled={!selectedCaso || estado === 'consulting'}
            className="w-full py-3 rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg hover:from-indigo-700 hover:to-indigo-800"
          >
            {estado === 'consulting' ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Consultando...
              </span>
            ) : 'Consultar código'}
          </button>

          {estado === 'result' && codigo && (
            <div className="mt-6 text-center bg-gradient-to-r from-indigo-50 to-violet-50 rounded-xl p-6 border border-indigo-100">
              <p className="text-sm text-gray-500 mb-2">Código de verificación</p>
              <p className="text-4xl sm:text-5xl font-bold tracking-widest text-indigo-700 select-all font-mono">
                {codigo}
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(codigo).then(() => toast.success('Copiado'))}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                <Copy size={16} />
                Copiar código
              </button>
            </div>
          )}

          {estado === 'error' && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <AlertCircle className="text-red-500 mx-auto mb-2" size={24} />
              <p className="text-red-700 text-sm">{errorMsg}</p>
            </div>
          )}
        </div>
      )}

      {modo === 'link' && cuentaId && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {/* Info de la cuenta + valores financieros */}
          <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100 mb-6">
            <Monitor size={18} className="text-indigo-500" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-indigo-900">{cuentaSeleccionada?.proveedor}</p>
              <p className="text-xs text-indigo-600">{cuentaSeleccionada?.correoCuenta}</p>
            </div>
            <span className="text-sm font-bold text-indigo-700">${cuentaSeleccionada?.costo.toLocaleString()}</span>
          </div>

          {/* Selector de perfiles */}
          {(() => {
            const perfiles = Array.isArray(cuentaSeleccionada?.perfiles) ? cuentaSeleccionada.perfiles : [];
            const disponibles = perfiles.filter(p => p.estado === 'disponible');
            if (disponibles.length === 0) return (
              <div className="p-4 mb-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-sm text-amber-700 font-medium">No hay perfiles disponibles en esta cuenta</p>
              </div>
            );
            return (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Perfiles a vender ({disponibles.length} disponibles)
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {disponibles.map(p => {
                    const idx = perfiles.indexOf(p);
                    const selected = perfilesSeleccionados.includes(idx);
                    return (
                      <label
                        key={idx}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          selected
                            ? 'border-indigo-400 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300'
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
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                        <span className="text-sm font-medium text-gray-700">{p.nombre}</span>
                        {p.pin && <span className="text-xs text-gray-400">PIN: {p.pin}</span>}
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
                  className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  {perfilesSeleccionados.length === disponibles.length
                    ? 'Deseleccionar todos'
                    : 'Seleccionar todos'}
                </button>
              </div>
            );
          })()}

          {/* Valores financieros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nombre del sub-distribuidor
              </label>
              <input
                type="text"
                value={nombreSub}
                onChange={e => setNombreSub(e.target.value)}
                className="w-full"
                placeholder="Ej: Juan Pérez"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Cantidad de perfiles
              </label>
              <input
                type="number"
                value={cantidad}
                className="w-full bg-gray-50"
                readOnly
                min="1"
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">Se auto-completa al seleccionar perfiles</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Total recibido $
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                <input
                  type="number"
                  value={totalRecibido}
                  onChange={e => setTotalRecibido(Number(e.target.value))}
                  className="w-full pl-7"
                  min="0"
                  step="100"
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Costo total</label>
              <div className="flex items-center h-[42px] px-4 bg-gray-50 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500">
                ${totalCosto.toLocaleString()}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Utilidad</label>
              <div className={`flex items-center h-[42px] px-4 rounded-xl border text-sm font-bold ${
                utilidad >= 0
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                ${utilidad.toLocaleString()}
              </div>
            </div>
          </div>
          {totalRecibido > 0 && cantidad > 0 && (
            <p className="text-xs text-gray-400 mb-6 text-right">
              ${totalRecibido.toLocaleString()} ÷ {cantidad} = ${precioPorPerfil.toLocaleString()} x perfil
            </p>
          )}

          <h2 className="text-lg font-semibold text-gray-900 mb-4">Duración del acceso</h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[7, 15, 30, 60].map(d => (
              <button
                key={d}
                onClick={() => setDiasAcceso(d)}
                className={`p-3 rounded-xl text-center transition-all border text-sm font-semibold ${
                  diasAcceso === d
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300'
                }`}
              >
                {d} días
              </button>
            ))}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-600 mb-1.5">O personalizado</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={diasAcceso}
                onChange={e => setDiasAcceso(Number(e.target.value))}
                min="1"
                max="365"
                className="w-24"
              />
              <span className="text-sm text-gray-500">días</span>
            </div>
          </div>

          <button
            onClick={generarLink}
            disabled={estado === 'generating'}
            className="w-full py-3 rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg hover:from-indigo-700 hover:to-indigo-800"
          >
            {estado === 'generating' ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Generando...
              </span>
            ) : 'Generar link'}
          </button>

          {linkGenerado && (
            <div className="mt-6 space-y-3">
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                <p className="text-sm font-medium text-indigo-700 mb-2">Link generado</p>
                <code className="block bg-white rounded-lg px-4 py-3 text-sm text-indigo-600 border border-indigo-200 break-all font-mono">
                  {linkGenerado}
                </code>
                <div className="flex items-center gap-2 mt-2 text-xs text-indigo-500">
                  <Calendar size={14} />
                  Expira: {linkExpira}
                </div>
              </div>
              <button
                onClick={copiarLink}
                className="w-full py-3 rounded-xl font-semibold transition-all bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <Copy size={18} />
                Copiar link
              </button>
            </div>
          )}
        </div>
      )}

      {modo === 'links' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Links para sub-distribuidores</h2>
          </div>
          {tokens.filter(t => !t.clienteId).length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-gray-400 italic">No hay links generados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Nombre</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Proveedor</th>
                    <th className="px-6 py-3 text-center font-semibold text-gray-600">Estado</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-600">Expira</th>
                    <th className="px-6 py-3 text-center font-semibold text-gray-600">ID</th>
                    <th className="px-6 py-3 text-center font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens
                    .filter(t => !t.clienteId)
                    .sort((a, b) => new Date(b.createdAt as unknown as string).getTime() - new Date(a.createdAt as unknown as string).getTime())
                    .slice(0, 20)
                    .map(token => {
                      const expirado = new Date(token.expiraEn) < new Date();
                      const proveedor = token.cuentaId
                        ? cuentas.find(c => c.id === token.cuentaId)?.proveedor || '—'
                        : '—';
                      return (
                        <tr key={token.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-semibold text-gray-900">{token.clienteNombre || '—'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-gray-700">{proveedor}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                              expirado
                                ? 'bg-red-100 text-red-600'
                                : token.activo
                                  ? 'bg-green-100 text-green-600'
                                  : 'bg-gray-100 text-gray-500'
                            }`}>
                              {expirado ? 'Vencido' : token.activo ? 'Activo' : 'Revocado'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-gray-500">
                            {new Date(token.expiraEn).toLocaleDateString('es-CO')}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <code className="text-xs text-gray-400 font-mono">{token.id.slice(0, 8)}</code>
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
                                  label: 'Revocar',
                                  icon: <X size={16} />,
                                  onClick: async () => {
                                    try {
                                      await revocarToken(token.id);
                                      toast.success('Token revocado');
                                    } catch { toast.error('Error al revocar'); }
                                  },
                                  variant: 'danger' as const,
                                }] : []),
                                ...(!token.activo || expirado ? [{
                                  label: 'Reactivar',
                                  icon: <RefreshCw size={16} />,
                                  onClick: async () => {
                                    try {
                                      await reactivarToken(token.id);
                                      toast.success('Token reactivado');
                                    } catch { toast.error('Error al reactivar'); }
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
