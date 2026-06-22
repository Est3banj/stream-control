import React, { useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Loader2, AlertCircle, Mail, Monitor } from 'lucide-react';
import CasoSelector, { CASE_LABELS } from './CasoSelector';
import CodeResult, { maskEmail } from './CodeResult';

const PROVEEDOR_CASOS: Record<string, string[]> = {
  Netflix: ['viajenet', 'hogarnet', 'resetnet', 'ininet'],
  Win: ['wincode'],
  ChatGPT: ['cgptcode'],
  'Universal+': ['univer1'],
  Max: ['accmax'],
};

interface ConsultaInternaProps {
  clienteNombre: string;
  proveedor: string;
  correoCuenta: string;
  tokenId: string;
  onClose: () => void;
}

type Estado = 'idle' | 'consulting' | 'result' | 'error';

export default function ConsultaInterna({ clienteNombre, proveedor, correoCuenta, tokenId, onClose }: ConsultaInternaProps) {
  const [selectedCaso, setSelectedCaso] = useState('');
  const [estado, setEstado] = useState<Estado>('idle');
  const [codeResult, setCodeResult] = useState<{ codigo: string; email: string; fecha: string; tipo: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [notFound, setNotFound] = useState(false);

  const casos = PROVEEDOR_CASOS[proveedor] || [];

  const consultar = useCallback(async () => {
    if (!selectedCaso || !tokenId) return;

    setEstado('consulting');
    setCodeResult(null);
    setErrorMsg('');
    setNotFound(false);

    try {
      const functions = getFunctions();
      const consultarCodigo = httpsCallable(functions, 'consultarCodigo');
      const result = await consultarCodigo({ token: tokenId, caso: selectedCaso });
      const data = result.data as Record<string, unknown>;

      if (data.encontrado) {
        setCodeResult({
          codigo: data.codigo as string,
          email: data.email as string,
          fecha: data.fecha as string,
          tipo: data.tipo as string,
        });
        setEstado('result');
      } else {
        setNotFound(true);
        setEstado('idle');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al consultar el código';
      setErrorMsg(message);
      setEstado('error');
    }
  }, [selectedCaso, tokenId]);

  const reiniciar = () => {
    setEstado('idle');
    setSelectedCaso('');
    setCodeResult(null);
    setErrorMsg('');
    setNotFound(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Consultar código</h2>
          <p className="text-gray-600 mt-1">{clienteNombre}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <span className="sr-only">Cerrar</span>
          <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 space-y-2">
        <div className="flex items-center gap-3 text-sm">
          <Monitor size={16} className="text-indigo-500 shrink-0" />
          <span className="text-gray-700 font-medium">{proveedor}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Mail size={16} className="text-indigo-500 shrink-0" />
          <span className="text-gray-600">{maskEmail(correoCuenta)}</span>
        </div>
      </div>

      {estado === 'idle' && (
        <div className="space-y-6">
          {notFound && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-amber-700 text-sm">
                No se encontró código de verificación. Intenta de nuevo en unos minutos.
              </p>
            </div>
          )}

          {casos.length > 0 ? (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Seleccioná el tipo de código</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {casos.map((caso) => (
                  <button
                    key={caso}
                    type="button"
                    onClick={() => setSelectedCaso(caso)}
                    className={`p-3 rounded-xl text-left transition-all border text-sm ${
                      selectedCaso === caso
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/50'
                    }`}
                  >
                    {CASE_LABELS[caso] || caso}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-gray-500 text-sm">No hay códigos disponibles para este proveedor</p>
            </div>
          )}

          <button
            onClick={consultar}
            disabled={!selectedCaso}
            className="w-full py-3 rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg hover:from-indigo-700 hover:to-indigo-800 active:scale-[0.98]"
          >
            Consultar código
          </button>
        </div>
      )}

      {estado === 'consulting' && (
        <div className="flex flex-col items-center py-8">
          <Loader2 className="animate-spin text-indigo-600 mb-4" size={36} />
          <p className="text-gray-600 font-medium">Buscando código de verificación...</p>
          <p className="text-gray-400 text-sm mt-1">Esto puede tomar unos segundos</p>
        </div>
      )}

      {estado === 'result' && codeResult && (
        <div className="space-y-6">
          <div className="text-center bg-gradient-to-r from-indigo-50 to-violet-50 rounded-xl p-6 border border-indigo-100">
            <p className="text-sm text-gray-500 mb-2">Código de verificación</p>
            <p className="text-4xl sm:text-5xl font-bold tracking-widest text-indigo-700 select-all font-mono">
              {codeResult.codigo}
            </p>
            <button
              onClick={() => navigator.clipboard.writeText(codeResult.codigo).then(() => {
                const btn = document.activeElement as HTMLButtonElement;
                if (btn) {
                  btn.textContent = '¡Copiado!';
                  setTimeout(() => { btn.textContent = 'Copiar código'; }, 2000);
                }
              })}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Copiar código
            </button>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <Mail size={16} className="text-gray-400 shrink-0" />
              <span className="text-gray-600">{maskEmail(codeResult.email)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 shrink-0 w-4">🕐</span>
              <span className="text-gray-600">
                {new Date(codeResult.fecha).toLocaleDateString('es-CO', {
                  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 shrink-0 w-4">🏷</span>
              <span className="text-gray-600">{CASE_LABELS[codeResult.tipo] || codeResult.tipo}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={reiniciar}
              className="flex-1 py-3 rounded-xl font-semibold transition-all bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Consultar otro código
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold transition-all bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg hover:from-indigo-700 hover:to-indigo-800"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {estado === 'error' && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertCircle className="text-red-500 mx-auto mb-3" size={36} />
            <p className="text-red-700 font-medium">{errorMsg}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setEstado('idle')}
              className="flex-1 py-3 rounded-xl font-semibold transition-all bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Intentar de nuevo
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold transition-all bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg hover:from-indigo-700 hover:to-indigo-800"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
