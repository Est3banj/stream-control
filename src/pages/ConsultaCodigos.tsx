import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useCuentas from '../hooks/useCuentas';
import usePermisos from '../hooks/usePermisos';
import FeatureBlocked from '../components/FeatureBlocked';
import { callFunction } from '../lib/apiClient';
import { Copy, Loader2, AlertCircle, Monitor, ExternalLink } from 'lucide-react';
import { CASE_LABELS } from '../components/CasoSelector';
import toast from 'react-hot-toast';

const PROVEEDOR_CASOS: Record<string, string[]> = {
  Netflix: ['viajenet', 'hogarnet', 'resetnet', 'ininet'],
  Win: ['wincode'],
  ChatGPT: ['cgptcode'],
  'Universal+': ['univer1'],
  Max: ['accmax'],
};

type Estado = 'idle' | 'consulting' | 'result' | 'error';

export default function ConsultaCodigos() {
  const { user } = useAuth();
  const { cuentas } = useCuentas(user);
  const permisos = usePermisos(user);

  const [cuentaId, setCuentaId] = useState('');
  const [selectedCaso, setSelectedCaso] = useState('');
  const [estado, setEstado] = useState<Estado>('idle');
  const [codigo, setCodigo] = useState('');
  const [codigoTipo, setCodigoTipo] = useState<'numerico' | 'link'>('numerico');
  const [errorMsg, setErrorMsg] = useState('');

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
      const data = await callFunction<{ cuentaId: string; caso: string }, Record<string, unknown>>('consultarCodigoDirecto', { cuentaId, caso: selectedCaso });

      if (data.encontrado) {
        setCodigo(data.codigo as string);
        setCodigoTipo((data.tipo as 'numerico' | 'link') || 'numerico');
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

  if (!permisos.puedeGenerarTokens) {
    return (
      <div className="space-y-6 animate-fade-in text-slate-100">
        <div className="mb-6">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
            Consulta de Códigos
          </h1>
          <p className="text-slate-400">Consultá códigos de verificación al instante</p>
        </div>
        <FeatureBlocked
          feature="Consulta de Códigos"
          description="Consultá códigos de verificación de tus cuentas de streaming al instante."
          plan="Enterprise"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
          Consulta de Códigos
        </h1>
        <p className="text-slate-400">Consultá códigos de verificación al instante</p>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl p-6 space-y-6 text-slate-100">
        {/* Selector de cuenta */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">Seleccionar cuenta</label>
          <select
            value={cuentaId}
            onChange={e => {
              setCuentaId(e.target.value);
              setSelectedCaso('');
              setEstado('idle');
            }}
            className="w-full h-11 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-sm font-normal text-slate-100 transition-all duration-150 appearance-none cursor-pointer"
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
          <div className="flex items-center gap-3 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
            <Monitor size={18} className="text-indigo-400" />
            <span className="text-sm font-semibold text-white">{cuentaSeleccionada?.proveedor}</span>
            <span className="text-xs text-slate-500">—</span>
            <span className="text-sm text-slate-300 font-mono">{cuentaSeleccionada?.correoCuenta}</span>
          </div>
        )}

        {cuentaId && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Tipo de código</h2>

            {casosDisponibles.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {casosDisponibles.map((caso) => (
                  <button
                    key={caso.value}
                    type="button"
                    onClick={() => setSelectedCaso(caso.value)}
                    className={`p-3 rounded-xl text-left transition-all border text-sm ${
                      selectedCaso === caso.value
                        ? 'border-indigo-500 bg-indigo-950/50 text-cyan-300 font-semibold shadow-md shadow-indigo-950/50'
                        : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {caso.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic mb-6">
                No hay códigos automáticos configurados para este proveedor
              </p>
            )}

            <button
              type="button"
              onClick={consultarCodigo}
              disabled={!selectedCaso || estado === 'consulting'}
              className="btn-primary w-full py-3.5 rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-950/50"
            >
              {estado === 'consulting' ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  Consultando...
                </span>
              ) : 'Consultar código'}
            </button>

            {estado === 'result' && codigo && codigoTipo === 'link' && (
              <div className="mt-6 bg-indigo-950/40 rounded-xl p-6 border border-indigo-800/40">
                <div className="text-center">
                  <p className="text-sm text-slate-400 mb-3">Enlace de código temporal</p>
                  <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 break-all">
                    <a
                      href={codigo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-300 hover:underline text-sm font-mono"
                    >
                      {codigo}
                    </a>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <a
                    href={codigo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary flex-1 inline-flex items-center justify-center gap-2 text-sm"
                  >
                    <ExternalLink size={16} />
                    Abrir enlace
                  </a>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(codigo).then(() => toast.success('Enlace copiado'))}
                    className="btn-secondary flex-1 inline-flex items-center justify-center gap-2 text-sm"
                  >
                    <Copy size={16} />
                    Copiar enlace
                  </button>
                </div>
              </div>
            )}

            {estado === 'result' && codigo && codigoTipo !== 'link' && (
              <div className="mt-6 text-center bg-indigo-950/40 rounded-xl p-6 border border-indigo-800/40">
                <p className="text-sm text-slate-400 mb-2">Código de verificación</p>
                <p className="text-4xl sm:text-5xl font-bold tracking-widest text-cyan-300 select-all font-mono">
                  {codigo}
                </p>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(codigo).then(() => toast.success('Copiado'))}
                  className="btn-primary mt-4 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm"
                >
                  <Copy size={16} />
                  Copiar código
                </button>
              </div>
            )}

            {estado === 'error' && (
              <div className="mt-6 bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 text-center">
                <AlertCircle className="text-rose-400 mx-auto mb-2" size={24} />
                <p className="text-rose-300 text-sm">{errorMsg}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
