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
      <div className="space-y-6 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-700">
            Consulta de Códigos
          </h1>
          <p className="text-gray-600">Consultá códigos de verificación al instante</p>
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
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-700">
          Consulta de Códigos
        </h1>
        <p className="text-gray-600">Consultá códigos de verificación al instante</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* Selector de cuenta */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Seleccionar cuenta</label>
          <select
            value={cuentaId}
            onChange={e => {
              setCuentaId(e.target.value);
              setSelectedCaso('');
              setEstado('idle');
            }}
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
          <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
            <Monitor size={18} className="text-indigo-500" />
            <span className="text-sm font-semibold text-indigo-900">{cuentaSeleccionada?.proveedor}</span>
            <span className="text-xs text-indigo-500">—</span>
            <span className="text-sm text-indigo-700">{cuentaSeleccionada?.correoCuenta}</span>
          </div>
        )}

        {cuentaId && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Tipo de código</h2>

            {casosDisponibles.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {casosDisponibles.map((caso) => (
                  <button
                    key={caso.value}
                    type="button"
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
                No hay códigos automáticos configurados para este proveedor
              </p>
            )}

            <button
              type="button"
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

            {estado === 'result' && codigo && codigoTipo === 'link' && (
              <div className="mt-6 bg-gradient-to-r from-indigo-50 to-violet-50 rounded-xl p-6 border border-indigo-100">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-3">Enlace de código temporal</p>
                  <div className="bg-white rounded-lg p-3 border border-indigo-100 break-all">
                    <a
                      href={codigo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline text-sm font-mono"
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
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    <ExternalLink size={16} />
                    Abrir enlace
                  </a>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(codigo).then(() => toast.success('Enlace copiado'))}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-white text-indigo-600 text-sm font-semibold border border-indigo-200 hover:bg-indigo-50 transition-colors"
                  >
                    <Copy size={16} />
                    Copiar enlace
                  </button>
                </div>
              </div>
            )}

            {estado === 'result' && codigo && codigoTipo !== 'link' && (
              <div className="mt-6 text-center bg-gradient-to-r from-indigo-50 to-violet-50 rounded-xl p-6 border border-indigo-100">
                <p className="text-sm text-gray-500 mb-2">Código de verificación</p>
                <p className="text-4xl sm:text-5xl font-bold tracking-widest text-indigo-700 select-all font-mono">
                  {codigo}
                </p>
                <button
                  type="button"
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
      </div>
    </div>
  );
}
