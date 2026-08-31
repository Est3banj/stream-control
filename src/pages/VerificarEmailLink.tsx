import { useEffect, useState } from 'react';
import { callFunction } from '../lib/apiClient';

type Status = 'loading' | 'success' | 'error';

export default function VerificarEmailLink() {
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Token no proporcionado. El enlace es inválido.');
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-950 px-4">
      <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-10 text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <h2 className="text-2xl font-bold text-white mb-2">Verificando tu correo...</h2>
            <p className="text-white/60">Un momento por favor.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">¡Correo verificado!</h2>
            <p className="text-white/70 mb-6">{message}</p>
            <p className="text-white/50 text-sm">Redirigiendo al panel...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No se pudo verificar</h2>
            <p className="text-white/70 mb-6">{message}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleReenviar}
                className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-violet-600 hover:to-indigo-600 text-white font-semibold py-3 px-6 rounded-xl transition-all"
              >
                Reenviar correo de verificación
              </button>
              <a
                href="/app/login"
                className="bg-white/10 border border-white/20 text-white font-semibold py-3 px-6 rounded-xl hover:bg-white/20 transition-all"
              >
                Ir a iniciar sesión
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
