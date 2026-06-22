import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { AlertCircle, Loader2, Search } from 'lucide-react';
import CasoSelector from '../components/CasoSelector';
import CodeResult from '../components/CodeResult';

type PageState = 'validating' | 'invalid' | 'ready' | 'consulting' | 'result' | 'error';

export default function ConsultaPublica() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>('validating');
  const [proveedor, setProveedor] = useState('');
  const [casos, setCasos] = useState<string[]>([]);
  const [selectedCaso, setSelectedCaso] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [codeResult, setCodeResult] = useState<{ codigo: string; email: string; fecha: string; tipo: string } | null>(null);
  const [notFoundMsg, setNotFoundMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setState('invalid');
      setErrorMsg('Token no proporcionado');
      return;
    }

    let cancelled = false;

    const validate = async () => {
      try {
        const functions = getFunctions();
        const validar = httpsCallable(functions, 'validarToken');
        const result = await validar({ token });
        const data = result.data as Record<string, unknown>;

        if (cancelled) return;

        if (data.valido) {
          setProveedor((data.proveedor as string) || '');
          setCasos((data.casos as string[]) || []);
          setSelectedCaso('');
          setState('ready' as PageState);
        } else {
          setState('invalid' as PageState);
          setErrorMsg((data.error as string) || 'Token inválido o expirado');
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setState('invalid' as PageState);
        const message = err instanceof Error ? err.message : 'Error al validar el token';
        setErrorMsg(message);
      }
    };

    validate();

    return () => { cancelled = true; };
  }, [token]);

  const consultarCodigoHandler = useCallback(async () => {
    if (!selectedCaso || !token) return;

    setState('consulting');
    setNotFoundMsg('');
    setCodeResult(null);

    try {
      const functions = getFunctions();
      const consultar = httpsCallable(functions, 'consultarCodigo');
      const result = await consultar({ token, caso: selectedCaso });
      const data = result.data as Record<string, unknown>;

      if (data.encontrado) {
        setCodeResult({
          codigo: data.codigo as string,
          email: data.email as string,
          fecha: data.fecha as string,
          tipo: data.tipo as string,
        });
        setState('result');
      } else {
        setNotFoundMsg((data.mensaje as string) || 'No se encontró código de verificación. Intenta de nuevo en unos minutos.');
        setState('ready');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al consultar el código';
      setErrorMsg(message);
      setState('error');
    }
  }, [selectedCaso, token]);

  return (
    <div className="min-h-screen bg-[#0a0a1a] bg-gradient-to-br from-[#0a0a1a] via-[#1a0a2e] to-[#0a0a1a] flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#ffc62a]/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        <div className="bg-white/[0.04] backdrop-blur-2xl rounded-3xl border border-white/[0.08] p-8 sm:p-10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#ffc62a]/10 mb-4">
              <Search className="text-[#ffc62a]" size={28} />
            </div>
            <h1 className="text-2xl font-bold text-white">
              {state === 'validating' && 'Validando...'}
              {state === 'invalid' && 'Token inválido'}
              {(state === 'ready' || state === 'consulting' || state === 'result' || state === 'error') && (
                <>Bienvenido{proveedor ? `, servicio ${proveedor}` : ''}</>
              )}
            </h1>
          </div>

          {state === 'validating' && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="animate-spin text-[#ffc62a] mb-4" size={36} />
              <p className="text-gray-400">Validando token...</p>
            </div>
          )}

          {state === 'invalid' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
              <AlertCircle className="text-red-400 mx-auto mb-3" size={36} />
              <p className="text-red-300 font-medium">{errorMsg}</p>
              <p className="text-gray-500 text-sm mt-3">
                Si creés que esto es un error, contactá a tu vendedor.
              </p>
            </div>
          )}

          {state === 'ready' && (
            <div className="space-y-6">
              {casos.length > 0 && (
                <CasoSelector
                  casos={casos}
                  selected={selectedCaso}
                  onSelect={setSelectedCaso}
                />
              )}

              {notFoundMsg && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                  <p className="text-amber-300 text-sm">{notFoundMsg}</p>
                </div>
              )}

              <button
                onClick={consultarCodigoHandler}
                disabled={!selectedCaso}
                className="w-full py-4 rounded-xl font-semibold text-base transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-[#ffc62a] text-black hover:bg-[#ffd84a] active:scale-[0.98]"
              >
                Consultar código
              </button>
            </div>
          )}

          {state === 'consulting' && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="animate-spin text-[#ffc62a] mb-4" size={36} />
              <p className="text-gray-400">Buscando código de verificación...</p>
              <p className="text-gray-600 text-sm mt-2">Esto puede tomar unos segundos</p>
            </div>
          )}

          {state === 'result' && codeResult && (
            <div className="space-y-6">
              <CodeResult
                code={codeResult.codigo}
                email={codeResult.email}
                fecha={codeResult.fecha}
                tipo={codeResult.tipo}
              />
              <button
                onClick={() => {
                  setState('ready');
                  setCodeResult(null);
                  setSelectedCaso('');
                  setNotFoundMsg('');
                }}
                className="w-full py-3 rounded-xl font-medium transition-all bg-white/10 text-white hover:bg-white/20 border border-white/10"
              >
                Consultar otro código
              </button>
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
                <AlertCircle className="text-red-400 mx-auto mb-3" size={36} />
                <p className="text-red-300 font-medium">{errorMsg}</p>
              </div>
              <button
                onClick={() => {
                  setState('ready');
                  setErrorMsg('');
                  setNotFoundMsg('');
                }}
                className="w-full py-3 rounded-xl font-medium transition-all bg-white/10 text-white hover:bg-white/20 border border-white/10"
              >
                Intentar de nuevo
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Stream Control — Consulta de códigos de verificación
        </p>
      </div>
    </div>
  );
}
