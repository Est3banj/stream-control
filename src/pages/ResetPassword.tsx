import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../firebase';
import { callFunction } from '../lib/apiClient';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Check,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import AuthLayout from '../components/Auth/AuthLayout';

type FlowStatus = 'validating' | 'ready' | 'invalid_code' | 'success';

export default function ResetPassword() {
  const [status, setStatus] = useState<FlowStatus>('validating');
  const [oobCode, setOobCode] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  let navigate: ReturnType<typeof useNavigate> | null = null;
  try {
    navigate = useNavigate();
  } catch {
    navigate = null;
  }

  const goToLogin = () => {
    if (navigate) {
      navigate('/login');
    } else {
      window.location.href = '/app/login';
    }
  };

  // Password rules validation
  const hasMinLength = password.length >= 6;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  // Read oobCode and verify on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('oobCode') || params.get('oob_code') || '';

    if (!code) {
      setStatus('invalid_code');
      setErrorMessage('No se encontró el código de recuperación en el enlace.');
      return;
    }

    setOobCode(code);
    setStatus('validating');

    verifyPasswordResetCode(auth, code)
      .then((email) => {
        setUserEmail(email);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        console.error('Error verifying password reset code:', err);
        setStatus('invalid_code');
        const error = err as { code?: string; message?: string };
        if (error.code === 'auth/expired-action-code') {
          setErrorMessage('El enlace de recuperación ha expirado. Por favor, solicitá uno nuevo.');
        } else if (error.code === 'auth/invalid-action-code') {
          setErrorMessage('El enlace de recuperación no es válido o ya fue utilizado.');
        } else if (error.code === 'auth/user-disabled') {
          setErrorMessage('La cuenta asociada a este enlace está desactivada.');
        } else {
          setErrorMessage(error.message || 'El enlace de recuperación no es válido.');
        }
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!password.trim() || !confirmPassword.trim()) {
      toast.error('Por favor completá todos los campos');
      return;
    }

    if (!hasMinLength) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Confirmar cambio de contraseña en Firebase Auth
      await confirmPasswordReset(auth, oobCode, password);

      // 2. Disparar notificación por email vía backend
      try {
        await callFunction('notificarPasswordReseteado', { email: userEmail });
      } catch (notifyErr) {
        console.warn('⚠️ No se pudo enviar el correo de notificación:', notifyErr);
      }

      // 3. Estado de éxito y redirección
      setStatus('success');
      toast.success('¡Contraseña restablecida con éxito!');

      setTimeout(() => {
        goToLogin();
      }, 2500);
    } catch (err: unknown) {
      console.error('Error al restablecer contraseña:', err);
      const error = err as { code?: string; message?: string };
      if (error.code === 'auth/expired-action-code') {
        setStatus('invalid_code');
        setErrorMessage('El enlace de recuperación ha expirado. Solicitá uno nuevo.');
      } else if (error.code === 'auth/invalid-action-code') {
        setStatus('invalid_code');
        setErrorMessage('El enlace de recuperación no es válido o ya fue utilizado.');
      } else if (error.code === 'auth/weak-password') {
        toast.error('La contraseña es muy débil. Usá al menos 6 caracteres combinando letras y números.');
      } else {
        toast.error(error.message || 'Error al restablecer la contraseña. Intentá nuevamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderBranding = () => (
    <div className="flex flex-col items-center mb-5 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-transparent border border-indigo-500/30 p-2 shadow-xl shadow-indigo-950/50 backdrop-blur-md flex items-center justify-center mb-3">
        <img
          src="/app/stream.webp"
          alt="StreamControl Pro"
          onError={(e) => {
            const target = e.currentTarget;
            if (!target.src.endsWith('/stream.webp') || target.src.includes('/app/stream.webp')) {
              target.src = '/stream.webp';
            }
          }}
          className="w-full h-full object-contain drop-shadow-md"
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xl font-bold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
          StreamControl Pro
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-full">
          <ShieldCheck className="w-3 h-3 text-indigo-400" />
          Seguridad
        </span>
      </div>
    </div>
  );

  return (
    <AuthLayout hideHeader>
      <div className="flex flex-col w-full">
        {/* ── ESTADO: VALIDANDO CÓDIGO ── */}
        {status === 'validating' && (
          <div className="flex flex-col items-center text-center py-2">
            {renderBranding()}
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3 shadow-lg shadow-indigo-950/40">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 tracking-tight">
              Verificando enlace...
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm">
              Estamos comprobando la validez de tu enlace de recuperación.
            </p>
          </div>
        )}

        {/* ── ESTADO: ENLACE INVÁLIDO O EXPIRADO ── */}
        {status === 'invalid_code' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center py-2"
          >
            {renderBranding()}
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3 shadow-lg shadow-rose-950/40">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1.5 tracking-tight">
              Enlace inválido o expirado
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mb-5 max-w-sm leading-relaxed">
              {errorMessage ||
                'El enlace para restablecer tu contraseña no es válido, ha expirado o ya fue utilizado anteriormente.'}
            </p>

            <div className="flex flex-col gap-2.5 w-full">
              <button
                type="button"
                onClick={goToLogin}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border border-indigo-400/30 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all duration-200 active:scale-[0.99]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Solicitar nuevo enlace</span>
              </button>
              <button
                type="button"
                onClick={goToLogin}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium text-sm transition-all"
              >
                <span>Volver al inicio de sesión</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── ESTADO: FORMULARIO DE NUEVA CONTRASEÑA ── */}
        {status === 'ready' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center w-full"
          >
            {renderBranding()}

            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
              Restablecer contraseña
            </h2>

            <p className="text-slate-400 text-xs sm:text-sm mb-4 leading-relaxed max-w-sm">
              Creá una nueva contraseña segura para tu cuenta
            </p>

            {/* Badge con el Correo Electrónico */}
            {userEmail && (
              <div className="w-full bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3.5 mb-4 flex items-center justify-between gap-2 text-left">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-medium">
                    Cuenta
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-slate-200 truncate block">
                    {userEmail}
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 w-full text-left" noValidate>
              {/* Nueva Contraseña */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">
                  Nueva contraseña
                </label>
                <div className="relative flex items-center bg-slate-950/70 border border-slate-800 rounded-2xl transition-all duration-200 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-slate-950/90">
                  <Lock className="w-4 h-4 text-slate-500 ml-3.5 mr-2 flex-shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    required
                    disabled={submitting}
                    className="w-full bg-transparent focus:bg-transparent py-3 pr-10 text-sm font-medium text-slate-100 focus:text-slate-100 caret-cyan-400 placeholder:text-slate-500 focus:outline-none disabled:opacity-50 [color-scheme:dark]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    className="absolute right-3 text-slate-400 hover:text-slate-200 p-1 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Indicadores de Requisitos */}
                {password.length > 0 && (
                  <div className="flex items-center gap-3 mt-2 px-1 text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 font-medium transition-colors ${
                        hasMinLength ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      <Check className={`w-3 h-3 ${hasMinLength ? 'opacity-100' : 'opacity-30'}`} />
                      6+ caracteres
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-medium transition-colors ${
                        hasLetter ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      <Check className={`w-3 h-3 ${hasLetter ? 'opacity-100' : 'opacity-30'}`} />
                      Letras
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-medium transition-colors ${
                        hasNumber ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      <Check className={`w-3 h-3 ${hasNumber ? 'opacity-100' : 'opacity-30'}`} />
                      Números
                    </span>
                  </div>
                )}
              </div>

              {/* Confirmar Contraseña */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">
                  Confirmar contraseña
                </label>
                <div className="relative flex items-center bg-slate-950/70 border border-slate-800 rounded-2xl transition-all duration-200 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-slate-950/90">
                  <Lock className="w-4 h-4 text-slate-500 ml-3.5 mr-2 flex-shrink-0" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repetí la nueva contraseña"
                    autoComplete="new-password"
                    required
                    disabled={submitting}
                    className="w-full bg-transparent focus:bg-transparent py-3 pr-10 text-sm font-medium text-slate-100 focus:text-slate-100 caret-cyan-400 placeholder:text-slate-500 focus:outline-none disabled:opacity-50 [color-scheme:dark]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? 'Ocultar confirmación de contraseña' : 'Ver confirmación de contraseña'}
                    className="absolute right-3 text-slate-400 hover:text-slate-200 p-1 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <div className="mt-1.5 ml-1 text-[11px]">
                    {passwordsMatch ? (
                      <span className="text-emerald-400 inline-flex items-center gap-1 font-medium">
                        <Check className="w-3 h-3" /> Las contraseñas coinciden
                      </span>
                    ) : (
                      <span className="text-rose-400 font-medium">
                        Las contraseñas no coinciden
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Botón Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="mt-3 w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border border-indigo-400/30 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all duration-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Actualizando contraseña...</span>
                  </>
                ) : (
                  <>
                    <span>Guardar nueva contraseña</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={goToLogin}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* ── ESTADO: ÉXITO ── */}
        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center py-2"
          >
            {renderBranding()}
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-lg shadow-emerald-950/40">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
              ¡Contraseña restablecida!
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mb-5 max-w-sm leading-relaxed">
              Tu contraseña fue actualizada correctamente. Te enviamos una notificación de seguridad a tu correo.
            </p>

            <div className="w-full bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 text-xs text-emerald-400 font-medium flex items-center justify-center gap-2 mb-4">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Redirigiendo al inicio de sesión...</span>
            </div>

            <button
              type="button"
              onClick={goToLogin}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-white font-medium text-sm transition-all"
            >
              <span>Iniciar sesión ahora</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </div>
    </AuthLayout>
  );
}
