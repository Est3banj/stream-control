import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { callFunction } from '../lib/apiClient';
import {
  AlertCircle, Loader2, RefreshCw, WifiOff, Timer, MessageCircle, ClipboardList, CheckCircle2,
} from 'lucide-react';
import CasoSelector from '../components/CasoSelector';
import CodeResult from '../components/CodeResult';
import { useAdminConfig, sanitizarWhatsApp } from '../hooks/useAdminConfig';

type PageState = 'validating' | 'invalid' | 'ready' | 'consulting' | 'result' | 'error';

const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return msg.includes('unavailable') || msg.includes('network') || msg.includes('failed to fetch') || msg.includes('internal');
}

interface ConsultaPublicaProps {
  token?: string;
}

export default function ConsultaPublica({ token: propToken }: ConsultaPublicaProps) {
  const { token: paramToken } = useParams<{ token: string }>();
  const token = propToken || paramToken;
  const { config } = useAdminConfig();
  const whatsappNumber = config.whatsapp ? sanitizarWhatsApp(config.whatsapp) : '';

  const [state, setState] = useState<PageState>('validating');
  const [errorMsg, setErrorMsg] = useState('');
  const [codeResult, setCodeResult] = useState<{ codigo: string; email: string; fecha: string; tipo: string; expiraEn?: number } | null>(null);
  const [notFoundMsg, setNotFoundMsg] = useState('');
  const [sessionWarning, setSessionWarning] = useState(false);

  const [email, setEmail] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [casos, setCasos] = useState<string[]>([]);
  const [selectedCaso, setSelectedCaso] = useState('');

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setSessionWarning(false);
  }, []);

  const startIdleTimer = useCallback(() => {
    resetIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      setSessionWarning(true);
    }, SESSION_TIMEOUT_MS);
  }, [resetIdleTimer]);

  useEffect(() => {
    if (state === 'ready') {
      startIdleTimer();
      const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
      events.forEach(ev => window.addEventListener(ev, resetIdleTimer));
      return () => {
        events.forEach(ev => window.removeEventListener(ev, resetIdleTimer));
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      };
    }
  }, [state, startIdleTimer, resetIdleTimer]);

  useEffect(() => {
    if (!token) {
      setState('invalid');
      setErrorMsg('Token no proporcionado');
      return;
    }

    let cancelled = false;

    const validate = async () => {
      try {
        const data = await callFunction<{ token: string }, Record<string, unknown>>('validarToken', { token });

        if (cancelled) return;

        if (data.valido) {
          setEmail((data.email as string) || '');
          setProveedor((data.proveedor as string) || '');
          setCasos((data.casos as string[]) || []);
          setSelectedCaso('');
          setState('ready');
        } else {
          setState('invalid');
          setErrorMsg((data.error as string) || 'Token inválido o expirado');
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Error al validar el token';
        if (isNetworkError(err)) {
          setErrorMsg('No se pudo conectar con el servidor. Verificá tu conexión a internet.');
        } else {
          setErrorMsg(message);
        }
        setState('invalid');
      }
    };

    validate();

    return () => { cancelled = true; };
  }, [token]);

  const handleLimpiar = useCallback(() => {
    setSelectedCaso('');
    setCodeResult(null);
    setNotFoundMsg('');
    setErrorMsg('');
    setState('ready');
  }, []);

  const consultarCodigoHandler = useCallback(async () => {
    if (!selectedCaso || !token) return;

    setState('consulting');
    setNotFoundMsg('');
    setCodeResult(null);
    resetIdleTimer();

    try {
      const data = await callFunction<{ token: string; caso: string }, Record<string, unknown>>('consultarCodigo', { token, caso: selectedCaso });

      if (data.encontrado) {
        setCodeResult({
          codigo: data.codigo as string,
          email: data.email as string,
          fecha: data.fecha as string,
          tipo: data.tipo as string,
          expiraEn: data.expiraEn as number | undefined,
        });
        setState('result');
      } else {
        setNotFoundMsg((data.mensaje as string) || 'No se encontró código de verificación. Intenta de nuevo en unos minutos.');
        setState('ready');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al consultar el código';
      if (isNetworkError(err)) {
        setErrorMsg('No se pudo conectar al servidor. Verificá tu conexión y volvé a intentar.');
      } else {
        setErrorMsg(message);
      }
      setState('error');
    }
  }, [selectedCaso, token, resetIdleTimer]);

  return (
    <div className="min-h-screen bg-[#0a0a1a] bg-gradient-to-br from-[#0a0a1a] via-[#1a0a2e] to-[#0a0a1a] flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#ffc62a]/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        <div className="bg-white/[0.04] backdrop-blur-2xl rounded-3xl border border-white/[0.08] p-8 sm:p-10 shadow-2xl">

          {/* HEADER */}
          <div className="flex items-center gap-3 mb-6">
            <img src="/stream.webp" alt="StreamControl" className="w-10 h-10 rounded-xl" />
            <h1 className="text-xl font-bold text-white">
              {state === 'validating' && 'Validando...'}
              {state === 'invalid' && 'Token inválido'}
              {(state === 'ready' || state === 'consulting' || state === 'result' || state === 'error') && 'Buscar información'}
            </h1>
          </div>

          {/* VALIDATING */}
          {state === 'validating' && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="animate-spin text-[#ffc62a] mb-4" size={36} />
              <p className="text-gray-400">Validando token...</p>
            </div>
          )}

          {/* INVALID */}
          {state === 'invalid' && (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
                {errorMsg.includes('conectar') ? (
                  <WifiOff className="text-red-400 mx-auto mb-3" size={36} />
                ) : (
                  <AlertCircle className="text-red-400 mx-auto mb-3" size={36} />
                )}
                <p className="text-red-300 font-medium">{errorMsg}</p>
                {errorMsg.includes('conectar') && (
                  <button
                    onClick={() => {
                      setState('validating');
                      window.location.reload();
                    }}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all bg-white/10 text-white hover:bg-white/20 border border-white/10 text-sm"
                  >
                    <RefreshCw size={16} />
                    Reintentar
                  </button>
                )}
              </div>
              {!errorMsg.includes('conectar') && (
                <p className="text-gray-500 text-sm text-center">
                  Si creés que esto es un error, contactá a tu vendedor.
                </p>
              )}
            </div>
          )}

          {/* READY — Formulario */}
          {state === 'ready' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Token</label>
                <input
                  type="text"
                  readOnly
                  value={token || ''}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Correo</label>
                <input
                  type="text"
                  readOnly
                  value={email || '—'}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 text-sm"
                />
              </div>

              {casos.length > 0 && (
                <CasoSelector
                  casos={casos}
                  selected={selectedCaso}
                  onSelect={setSelectedCaso}
                />
              )}

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardList size={16} className="text-[#ffc62a]" />
                  <span className="text-sm font-semibold text-[#ffc62a] uppercase tracking-wider">Pasos a seguir</span>
                </div>
                <ol className="space-y-2 text-sm text-gray-400 list-decimal list-inside">
                  <li>Ingresá el token que te fue asignado.</li>
                  <li>Seleccioná el tipo de código que necesitás.</li>
                  <li>Hacé clic en <strong className="text-gray-300">Consultar</strong> y esperá unos segundos.</li>
                </ol>
              </div>

              {notFoundMsg && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                  <p className="text-amber-300 text-sm">{notFoundMsg}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={consultarCodigoHandler}
                  disabled={!selectedCaso}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-[#ffc62a] text-black hover:bg-[#ffd84a] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={18} />
                  Consultar
                </button>
                <button
                  onClick={handleLimpiar}
                  className="px-5 py-3 rounded-xl font-medium text-sm transition-all bg-white/10 text-white hover:bg-white/20 border border-white/10"
                >
                  Limpiar
                </button>
              </div>
            </div>
          )}

          {/* CONSULTING */}
          {state === 'consulting' && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="animate-spin text-[#ffc62a] mb-4" size={36} />
              <p className="text-gray-400">Buscando código de verificación...</p>
              <p className="text-gray-600 text-sm mt-2">Esto puede tomar unos segundos</p>
            </div>
          )}

          {/* RESULT */}
          {state === 'result' && codeResult && (
            <div className="space-y-6">
              <CodeResult
                code={codeResult.codigo}
                email={codeResult.email}
                fecha={codeResult.fecha}
                tipo={codeResult.tipo}
                expiraEn={codeResult.expiraEn}
              />
              <button
                onClick={handleLimpiar}
                className="w-full py-3 rounded-xl font-medium transition-all bg-white/10 text-white hover:bg-white/20 border border-white/10"
              >
                Consultar otro código
              </button>
            </div>
          )}

          {/* ERROR */}
          {state === 'error' && (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
                {errorMsg.includes('conectar') ? (
                  <WifiOff className="text-red-400 mx-auto mb-3" size={36} />
                ) : (
                  <AlertCircle className="text-red-400 mx-auto mb-3" size={36} />
                )}
                <p className="text-red-300 font-medium">{errorMsg}</p>
              </div>
              <button
                onClick={() => {
                  setState('ready');
                  setErrorMsg('');
                  setNotFoundMsg('');
                }}
                className="w-full py-3 rounded-xl font-medium transition-all bg-white/10 text-white hover:bg-white/20 border border-white/10 flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} />
                Intentar de nuevo
              </button>
            </div>
          )}

          {/* Session warning */}
          {sessionWarning && state === 'ready' && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
              <Timer size={20} className="text-amber-400 shrink-0" />
              <p className="text-amber-300 text-sm">
                Sesión inactiva. Por seguridad, la página se recargará si no realizás ninguna acción.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Stream Control — Consulta de códigos de verificación
        </p>
      </div>

      {/* Botón flotante de soporte por WhatsApp */}
      {whatsappNumber && (
        <a
          href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hola, necesito ayuda con el servicio de streaming.')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-5 right-5 z-50 group"
        >
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900/90 text-white text-sm font-medium px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg backdrop-blur-sm">
            Chateá con soporte
          </span>
          <div className="flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 bg-[#25D366] text-white hover:bg-[#20bd5a]">
            <MessageCircle size={22} />
          </div>
        </a>
      )}
    </div>
  );
}
