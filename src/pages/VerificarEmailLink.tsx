import React, { useEffect, useState } from 'react';
import { callFunction } from '../lib/apiClient';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import AuthLayout from '../components/Auth/AuthLayout';

type Status = 'loading' | 'success' | 'error';

export default function VerificarEmailLink() {
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Token no proporcionado. El enlace es inválido o está incompleto.');
      return;
    }

    callFunction<{ token: string }, { success: boolean; alreadyVerified?: boolean }>(
      'verificarEmailToken',
      { token }
    )
      .then((result: { success: boolean; alreadyVerified?: boolean }) => {
        setStatus('success');
        if (result.alreadyVerified) {
          setMessage('Tu correo ya estaba verificado anteriormente.');
        } else {
          setMessage('Tu correo ha sido verificado exitosamente.');
        }
        // Volver al app con flag de éxito — VerificarEmail lo detecta y refresca
        setTimeout(() => {
          window.location.href = '/app/verificar-email?verified=true';
        }, 1500);
      })
      .catch((err: { message?: string }) => {
        setStatus('error');
        setMessage(err.message || 'Error al verificar el correo. El enlace puede haber expirado.');
      });
  }, []);

  const handleReenviar = () => {
    window.location.href = '/app/verificar-email';
  };

  return (
    <AuthLayout
      subtitle="Validación de enlace de seguridad"
      badge="Verificación"
    >
      <div className="flex flex-col items-center text-center py-2">
        {status === 'loading' && (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 shadow-lg shadow-indigo-950/40">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 tracking-tight">
              Verificando tu correo...
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">Un momento por favor.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-950/40">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">
              ¡Correo verificado!
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mb-4">{message}</p>
            <div className="w-full bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 text-xs text-emerald-400 font-medium flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Redirigiendo al panel...</span>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center w-full">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-lg shadow-rose-950/40">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 tracking-tight">
              No se pudo verificar
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mb-5 max-w-sm">{message}</p>
            <div className="flex flex-col gap-2.5 w-full">
              <button
                type="button"
                onClick={handleReenviar}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border border-indigo-400/30 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.99]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reenviar código de verificación</span>
              </button>
              <a
                href="/app/login"
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium text-sm transition-all"
              >
                <span>Ir a iniciar sesión</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
