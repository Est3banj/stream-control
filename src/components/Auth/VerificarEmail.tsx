import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Edit3, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useEmailVerificationWatcher } from '../../hooks/useEmailVerificationWatcher';
import type { VerificationStep } from '../../types/authVerification';
import RadarPing from './RadarPing';
import CooldownButton from './CooldownButton';
import SuccessCelebration from './SuccessCelebration';
import CambiarEmailModal from './CambiarEmailModal';
import toast from 'react-hot-toast';

export default function VerificarEmail() {
  const { user, sendVerificationEmail, refreshUser, logout } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<VerificationStep>('AWAITING');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [currentDisplayEmail, setCurrentDisplayEmail] = useState<string>(user?.correo || user?.email || '');

  useEffect(() => {
    if (user?.correo || user?.email) {
      setCurrentDisplayEmail(user.correo || user.email || '');
    }
  }, [user?.correo, user?.email]);

  // Si vino con ?verified=true (ej. desde el enlace público /r/verificar-email)
  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      refreshUser()
        .then((verificado) => {
          if (verificado) {
            setStep('SUCCESS');
          } else {
            toast.success('Correo verificado. Iniciá sesión si es necesario.');
          }
        })
        .catch(() => {
          // Ignorar error y dejar que el watcher continúe
        });
    }
  }, [searchParams, refreshUser]);

  // Hook reactivo con smart polling (3.5s), focus triggers y BroadcastChannel
  const { checkStatus, isChecking } = useEmailVerificationWatcher({
    enabled: step === 'AWAITING' || step === 'CHECKING_MANUAL',
    pollingIntervalMs: 3500,
    onVerified: () => {
      setStep('SUCCESS');
      toast.success('¡Correo verificado con éxito!');
    },
  });

  // Guardianes de autenticación y verificación
  if (!user) return <Navigate to="/login" replace />;
  if (user.emailVerified || user.rol === 'admin') return <Navigate to="/" replace />;

  const handleReenviar = async () => {
    setEnviando(true);
    try {
      await sendVerificationEmail();
      toast.success('Correo enviado. Revisá tu bandeja de entrada o spam.');
    } catch (error: unknown) {
      console.error(error);
      const err = error as { code?: string; message?: string };
      if (err.code === 'functions/resource-exhausted') {
        toast.error('Esperá un momento antes de solicitar otro correo.');
      } else {
        toast.error(err.message || 'Error al enviar el correo de verificación.');
      }
      throw error; // Propagar a CooldownButton para no iniciar cooldown si falló
    } finally {
      setEnviando(false);
    }
  };

  const handleManualCheck = async () => {
    const isVerified = await checkStatus();
    if (!isVerified && step !== 'SUCCESS') {
      toast('Aún no registramos la verificación. Si hiciste clic, aguardá unos segundos.', {
        icon: '⏳',
      });
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
              {/* Radar animado */}
              <div className="mb-6">
                <RadarPing isChecking={isChecking} />
              </div>

              {/* Título y Estado */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Sondeo en tiempo real</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight">
                Verificá tu correo
              </h2>

              <p className="text-white/70 text-sm mb-4 leading-relaxed max-w-md">
                Enviamos un enlace de confirmación a:
              </p>

              {/* Badge con el Correo Electrónico y Opción de Cambio */}
              <div className="w-full bg-white/10 border border-white/15 rounded-2xl p-3.5 mb-6 flex items-center justify-between gap-2 text-left backdrop-blur-md">
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

              {/* Acciones Principales */}
              <div className="w-full flex flex-col gap-3">
                {/* Botón de Comprobación Manual */}
                <button
                  type="button"
                  onClick={handleManualCheck}
                  disabled={isChecking}
                  className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-white/15 hover:bg-white/20 border border-white/20 text-white font-semibold transition-all duration-300 active:scale-[0.99] disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{isChecking ? 'Comprobando...' : 'Ya lo verifiqué (Comprobar)'}</span>
                </button>

                {/* Botón de Reenvío con Cooldown de 60s */}
                <CooldownButton
                  onClick={handleReenviar}
                  durationSeconds={60}
                  loading={enviando}
                  label="Reenviar correo de verificación"
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
          toast.success('Correo actualizado.');
        }}
      />

      <footer className="relative z-10 mt-8 text-white/60 text-xs text-center font-light">
        © StreamControl Pro — Plataforma de Gestión
      </footer>
    </div>
  );
}
