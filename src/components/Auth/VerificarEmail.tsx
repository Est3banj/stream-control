import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Edit3, ShieldCheck, ArrowRight, Loader2, MessageCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminConfig, getWhatsAppSupportNumber } from '../../hooks/useAdminConfig';
import type { VerificationStep } from '../../types/authVerification';
import AuthLayout from './AuthLayout';
import OtpInput from './OtpInput';
import CooldownButton from './CooldownButton';
import SuccessCelebration from './SuccessCelebration';
import CambiarEmailModal from './CambiarEmailModal';
import toast from 'react-hot-toast';

export default function VerificarEmail() {
  const { user, loading, enviarCodigoOTP, verificarCodigo, logout } = useAuth();
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
  const { config } = useAdminConfig();
  const whatsappNumber = getWhatsAppSupportNumber(config?.whatsapp);
  const mensajeWhatsApp = encodeURIComponent(
    `Hola, necesito ayuda con la verificación de mi cuenta en StreamControl. Mi correo es: ${currentDisplayEmail}`
  );
  const whatsappSupportUrl = `https://wa.me/${whatsappNumber}?text=${mensajeWhatsApp}`;

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

  // Guardianes de autenticación y verificación (deben ejecutarse después de todos los hooks)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-sm font-medium">Verificando sesión...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (step !== 'SUCCESS' && (user.emailVerified || user.rol === 'admin')) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthLayout hideHeader>
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center text-center"
          >
            {/* Isotipo & Branding Integrado */}
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

            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
              Verificación de seguridad
            </h2>

            <p className="text-slate-400 text-xs sm:text-sm mb-4 leading-relaxed max-w-sm">
              Ingresá el código de 6 dígitos enviado a tu correo
            </p>

            {/* Badge con el Correo Electrónico y Opción de Cambio */}
            <div className="w-full bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3.5 mb-3 flex items-center justify-between gap-2 text-left">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-medium">
                  Destinatario
                </span>
                <span className="text-xs sm:text-sm font-semibold text-slate-200 truncate block">
                  {currentDisplayEmail || 'usuario@correo.com'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-300 hover:text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700/80 transition-colors flex-shrink-0"
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
              <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-2xl px-3.5 py-2.5 my-2 w-full text-center">
                {errorMessage}
              </div>
            )}

            {/* Acciones Principales */}
            <div className="w-full flex flex-col gap-2.5 mt-2">
              {/* Botón de Validación Manual */}
              <button
                type="button"
                onClick={() => handleVerify()}
                disabled={otpCode.length !== 6 || isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border border-indigo-400/30 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all duration-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
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

            {/* Ayuda / Soporte y Salida */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 w-full flex flex-col items-center gap-3 text-xs">
              <div className="flex items-center justify-center gap-1.5 text-slate-400">
                <span>¿Problemas con el registro?</span>
                <a
                  href={whatsappSupportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Contactar soporte</span>
                </a>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 font-medium transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
    </AuthLayout>
  );
}
