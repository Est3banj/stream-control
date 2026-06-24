import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useCuentas from '../hooks/useCuentas';
import useTokens, { revocarToken, reactivarToken } from '../hooks/useTokens';
import usePermisos from '../hooks/usePermisos';
import FeatureBlocked from '../components/FeatureBlocked';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Copy, Loader2, AlertCircle, Monitor, Calendar, Link as LinkIcon, X, RefreshCw, ExternalLink } from 'lucide-react';
import { CASE_OPTIONS, CASE_LABELS } from '../components/CasoSelector';
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
  const [modo, setModo] = useState<'directo' | 'link'>('directo');
  const [diasAcceso, setDiasAcceso] = useState(30);
  const [linkGenerado, setLinkGenerado] = useState('');
  const [linkExpira, setLinkExpira] = useState('');

  const cuentasConIMAP = useMemo(() =>
    cuentas.filter(c => c.estado !== 'expirada'),
  [cuentas]);

  const cuentaSeleccionada = cuentas.find(c => c.id === cuentaId);

  const proveedor = cuentaSeleccionada?.proveedor || '';
  const casosDisponibles = (PROVEEDOR_CASOS[proveedor] || [])
    .filter(c => c !== 'resetnet')
    .map(value => ({ value, label: CASE_LABELS[value] || value }));

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
      const result = await fn({ cuentaId, expiraEn });
      const data = result.data as Record<string, unknown>;

      const url = `${window.location.origin}${data.url}`;
      setLinkGenerado(url);
      setLinkExpira(new Date(expiraEn).toLocaleDateString('es-CO'));
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
            className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
              modo === 'directo'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🔍 Consulta directa
          </button>
          <button
            onClick={() => setModo('link')}
            className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
              modo === 'link'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🔗 Generar link
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

      {/* Links activos */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Links activos</h2>
        {tokens.length === 0 ? (
          <p className="text-sm text-gray-500 italic text-center py-4">No hay tokens generados</p>
        ) : (
          <div className="space-y-3">
            {tokens
              .filter(t => !t.clienteId && !t.clienteNombre)
              .sort((a, b) => new Date(b.createdAt as unknown as string).getTime() - new Date(a.createdAt as unknown as string).getTime())
              .slice(0, 20)
              .map(token => {
                const expirado = new Date(token.expiraEn) < new Date();
                return (
                  <div key={token.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {token.cuentaId ? cuentas.find(c => c.id === token.cuentaId)?.proveedor || 'Cuenta' : '—'}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          expirado
                            ? 'bg-red-100 text-red-600'
                            : token.activo
                              ? 'bg-green-100 text-green-600'
                              : 'bg-gray-100 text-gray-500'
                        }`}>
                          {expirado ? 'Vencido' : token.activo ? 'Activo' : 'Revocado'}
                        </span>
                        <span className="text-xs text-gray-500">
                          Expira: {new Date(token.expiraEn).toLocaleDateString('es-CO')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/r/${token.id}`;
                          navigator.clipboard.writeText(url);
                          toast.success('Link copiado');
                        }}
                        className="p-2 rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors"
                        title="Copiar link"
                      >
                        <Copy size={16} />
                      </button>
                      {token.activo && !expirado && (
                        <button
                          onClick={async () => {
                            try {
                              await revocarToken(token.id);
                              toast.success('Token revocado');
                            } catch { toast.error('Error al revocar'); }
                          }}
                          className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                          title="Revocar"
                        >
                          <X size={16} />
                        </button>
                      )}
                      {(!token.activo || expirado) && (
                        <button
                          onClick={async () => {
                            try {
                              await reactivarToken(token.id);
                              toast.success('Token reactivado');
                            } catch { toast.error('Error al reactivar'); }
                          }}
                          className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                          title="Reactivar"
                        >
                          <RefreshCw size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
