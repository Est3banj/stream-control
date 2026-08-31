import React, { useState, useCallback } from 'react';
import { callFunction } from '../lib/apiClient';
import { Loader2, AlertCircle, Mail, Monitor, Clock, Tag } from 'lucide-react';
import CasoSelector, { CASE_LABELS } from './CasoSelector';
import CodeResult from './CodeResult';
import { maskEmail } from '../constants';

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
      const data = await callFunction<{ token: string; caso: string }, Record<string, unknown>>('consultarCodigo', { token: tokenId, caso: selectedCaso });

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
    <div className="space-y-6 text-slate-100">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Consultar código</h2>
          <p className="text-slate-400 mt-1">{clienteNombre}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span className="sr-only">Cerrar</span>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-2">
        <div className="flex items-center gap-3 text-sm">
          <Monitor size={16} className="text-indigo-400 shrink-0" />
          <span className="text-slate-200 font-medium">{proveedor}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Mail size={16} className="text-indigo-400 shrink-0" />
          <span className="text-slate-400">{maskEmail(correoCuenta)}</span>
        </div>
      </div>

      {estado === 'idle' && (
        <div className="space-y-6">
          {notFound && (
            <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-4 text-center">
              <p className="text-amber-300 text-sm">
                No se encontró código de verificación. Intenta de nuevo en unos minutos.
              </p>
            </div>
          )}

          {casos.length > 0 ? (
            <div>
              <p className="text-sm font-semibold text-slate-300 mb-3">Seleccioná el tipo de código</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {casos.map((caso) => (
                  <button
                    key={caso}
                    type="button"
                    onClick={() => setSelectedCaso(caso)}
                    className={`p-3 rounded-xl text-left transition-all border text-sm ${
                      selectedCaso === caso
                        ? 'border-indigo-500 bg-indigo-950/40 text-cyan-300 font-semibold shadow-md shadow-indigo-950/30'
                        : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {CASE_LABELS[caso] || caso}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-center">
              <p className="text-slate-400 text-sm">No hay códigos disponibles para este proveedor</p>
            </div>
          )}

          <button
            onClick={consultar}
            disabled={!selectedCaso}
            className="btn-primary w-full py-3 text-center disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Consultar código
          </button>
        </div>
      )}

      {estado === 'consulting' && (
        <div className="flex flex-col items-center py-8">
          <Loader2 className="animate-spin text-indigo-400 mb-4" size={36} />
          <p className="text-slate-200 font-medium">Buscando código de verificación...</p>
          <p className="text-slate-400 text-sm mt-1">Esto puede tomar unos segundos</p>
        </div>
      )}

      {estado === 'result' && codeResult && (
        <div className="space-y-6">
          <div className="text-center bg-slate-950/80 rounded-xl p-6 border border-slate-800">
            <p className="text-sm text-slate-400 mb-2">Código de verificación</p>
            <p className="text-4xl sm:text-5xl font-bold tracking-widest text-amber-400 select-all font-mono">
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
              className="mt-4 inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-950/50"
            >
              Copiar código
            </button>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <Mail size={16} className="text-indigo-400 shrink-0" />
              <span className="text-slate-300">{maskEmail(codeResult.email)}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock size={16} className="text-indigo-400 shrink-0" />
              <span className="text-slate-300">
                {new Date(codeResult.fecha).toLocaleDateString('es-CO', {
                  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Tag size={16} className="text-indigo-400 shrink-0" />
              <span className="text-slate-300">{CASE_LABELS[codeResult.tipo] || codeResult.tipo}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={reiniciar}
              className="btn-secondary flex-1 py-3"
            >
              Consultar otro código
            </button>
            <button
              onClick={onClose}
              className="btn-primary flex-1 py-3"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {estado === 'error' && (
        <div className="space-y-4">
          <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-6 text-center text-rose-300">
            <AlertCircle className="text-rose-400 mx-auto mb-3" size={36} />
            <p className="font-medium">{errorMsg}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setEstado('idle')}
              className="btn-secondary flex-1 py-3"
            >
              Intentar de nuevo
            </button>
            <button
              onClick={onClose}
              className="btn-primary flex-1 py-3"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
