import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Edit3, ShieldCheck, ArrowRight, Loader2, KeyRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { VerificationStep } from '../../types/authVerification';
import OtpInput from './OtpInput';
import CooldownButton from './CooldownButton';
import SuccessCelebration from './SuccessCelebration';
import CambiarEmailModal from './CambiarEmailModal';
import toast from 'react-hot-toast';

export default function VerificarEmail() {
  const { user, enviarCodigoOTP, verificarCodigo, logout } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<VerificationStep>('AWAITING');
  const [otpCode, setOtpCode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [currentDisplayEmail, setCurrentDisplayEmail] = useState<string>(
    user?.correo || user?.email || ''
  );

  useEffect(() => {
    if (user?.correo || user?.email) {
      setCurrentDisplayEmail(user.correo || user.email || '');
    }
  }, [user?.correo, user?.email]);

  // Si vino con ?verified=true (ej. desde enlace legado de confirmación)
  useEffect(() => {
    if (searchParams.get('verified') === 'true' && user?.uid) {
      setStep('SUCCESS');
    }
  }, [searchParams, user?.uid]);

  // Guardianes de autenticación y verificación
  if (!user) return <Navigate to="/login" replace />;
  if (user.emailVerified || user.rol === 'admin') return <Navigate to="/" replace />;

  const handleVerify = useCallback(
    async (codeToVerify?: string) => {
      const code = (codeToVerify ?? otpCode).trim();
      if (code.length !== 6 || isSubmitting) return;

      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        await verificarCodigo(code, currentDisplayEmail);
        setStep('SUCCESS');
        toast.success('¡Correo verificado con éxito!');
      } catch (error: unknown) {
        console.error('Error al verificar OTP:', error);
        const err = error as { code?: string; message?: string };
        const msg = err.message || 'Código incorrecto. Revisá e intentá nuevamente.';
        setErrorMessage(msg);
        toast.error(msg);

        // Si expiró o agotó intentos, limpiar input
        if (
          err.code === 'deadline-exceeded' ||
          err.code === 'resource-exhausted' ||
          msg.toLowerCase().includes('expir') ||
          msg.toLowerCase().includes('límite')
        ) {
          setOtpCode('');
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [otpCode, isSubmitting, verificarCodigo, currentDisplayEmail]
  );

  const handleReenviar = async () => {
    setEnviando(true);
    setErrorMessage(null);
    try {
      if (enviarCodigoOTP) {
        await enviarCodigoOTP(currentDisplayEmail);
      }
      setOtpCode('');
      toast.success('Código enviado. Revisá tu casilla de correo o spam.');
    } catch (error: unknown) {
      console.error('Error al reenviar OTP:', error);
      const err = error as { code?: string; message?: string };
      if (err.code === 'resource-exhausted' || err.code === 'functions/resource-exhausted') {
        toast.error('Esperá un minuto antes de solicitar otro código OTP.');
      } else {
        toast.error(err.message || 'Error al enviar el código de verificación.');
      }
      throw error; // Propagar a CooldownButton para no iniciar cooldown si falló
    } finally {
      setEnviando(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      nav('/login', { replace: true });
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
      nav('/login', { replace: true });
    }
  };

  const handleSuccessRedirect = () => {
    nav('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative bg-gradient-to-tr from-indigo-950 via-indigo-900 to-violet-950 overflow-hidden px-4 font-sans text-white">
      {/* Elementos ambientales de fondo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Contenedor Principal Glassmorphic */}
      <div className="relative z-10 w-full max-w-lg bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-6 sm:p-10 transition-all duration-500">
        <AnimatePresence mode="wait">
          {step === 'SUCCESS' ? (
            <SuccessCelebration
              key="success-celebration"
              onContinue={handleSuccessRedirect}
              redirectDelaySeconds={3}
              userEmail={currentDisplayEmail}
            />
          ) : (
            <motion.div
              key="verification-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center"
            >
              {/* Isotipo / Badge animado */}
              <div className="mb-5 w-16 h-16 rounded-3xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-indigo-300">
                <KeyRound className="w-8 h-8" />
              </div>

              {/* Título y Estado */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Código de seguridad</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight">
                Verificá tu correo
              </h2>

              <p className="text-white/70 text-sm mb-4 leading-relaxed max-w-md">
                Ingresá el código de 6 dígitos que enviamos a:
              </p>

              {/* Badge con el Correo Electrónico y Opción de Cambio */}
              <div className="w-full bg-white/10 border border-white/15 rounded-2xl p-3.5 mb-4 flex items-center justify-between gap-2 text-left backdrop-blur-md">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] uppercase tracking-wider text-white/50 block font-medium">
                    Destinatario
                  </span>
                  <span className="text-sm font-semibold text-white truncate block">
                    {currentDisplayEmail || 'usuario@correo.com'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-1 text-xs font-medium text-indigo-300 hover:text-indigo-100 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/10 transition-colors flex-shrink-0"
                  title="Corregir correo"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
              </div>

              {/* Entrada de 6 Dígitos OTP */}
              <OtpInput
                value={otpCode}
                onChange={(val) => {
                  setOtpCode(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                onComplete={(val) => {
                  handleVerify(val);
                }}
                disabled={isSubmitting}
                hasError={Boolean(errorMessage)}
              />

              {/* Mensaje de Error en línea si existe */}
              {errorMessage && (
                <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 my-2 w-full text-center">
                  {errorMessage}
                </div>
              )}

              {/* Acciones Principales */}
              <div className="w-full flex flex-col gap-3 mt-3">
                {/* Botón de Validación Manual */}
                <button
                  type="button"
                  onClick={() => handleVerify()}
                  disabled={otpCode.length !== 6 || isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-violet-600 hover:to-indigo-600 border border-indigo-400/40 text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all duration-300 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Verificando código...</span>
                    </>
                  ) : (
                    <>
                      <span>Verificar código</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Botón de Reenvío con Cooldown de 60s */}
                <CooldownButton
                  onClick={handleReenviar}
                  durationSeconds={60}
                  loading={enviando}
                  label="Reenviar código OTP"
                />
              </div>

              {/* Botón de Salida / Cerrar Sesión */}
              <div className="mt-6 pt-5 border-t border-white/10 w-full flex items-center justify-between text-xs text-white/60">
                <span>¿Problemas con el registro?</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 text-white/70 hover:text-white font-medium transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal de Corrección de Correo */}
      <CambiarEmailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentEmail={currentDisplayEmail}
        onSuccess={(newEmail) => {
          setCurrentDisplayEmail(newEmail);
          setOtpCode('');
          setErrorMessage(null);
          toast.success('Correo actualizado y nuevo código enviado.');
        }}
      />

      <footer className="relative z-10 mt-8 text-white/60 text-xs text-center font-light">
        © StreamControl Pro — Plataforma de Gestión
      </footer>
    </div>
  );
}
