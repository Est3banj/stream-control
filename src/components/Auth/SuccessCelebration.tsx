import React, { useState, useEffect } from 'react';
import { motion, type Variants } from 'framer-motion';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

interface SuccessCelebrationProps {
  onContinue: () => void;
  redirectDelaySeconds?: number;
  userEmail?: string;
  className?: string;
}

export const pathVariants: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: 'easeInOut',
      delay: 0.2,
    },
  },
};

export const circleVariants: Variants = {
  hidden: { scale: 0.6, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 320,
      damping: 22,
    },
  },
};

export const SuccessCelebration: React.FC<SuccessCelebrationProps> = ({
  onContinue,
  redirectDelaySeconds = 3,
  userEmail,
  className = '',
}) => {
  const [countdown, setCountdown] = useState(redirectDelaySeconds);

  useEffect(() => {
    if (countdown <= 0) {
      onContinue();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, onContinue]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`flex flex-col items-center text-center ${className}`}
    >
      {/* Icono de Check Animado con ondas verdes y resplandor sutil */}
      <div className="relative mb-5">
        <motion.div
          animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0, 0.35] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -inset-3 rounded-full bg-emerald-500/20 blur-md pointer-events-none"
        />

        <motion.div
          variants={circleVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 w-20 h-20 sm:w-22 sm:h-22 rounded-3xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center shadow-xl shadow-emerald-950/60 border border-emerald-300/30"
        >
          <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none">
            <motion.path
              variants={pathVariants}
              initial="hidden"
              animate="visible"
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      </div>

      <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-3 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
        <Sparkles className="w-3.5 h-3.5" />
        <span>¡Verificación confirmada!</span>
      </div>

      <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight">
        ¡Tu cuenta está lista!
      </h2>

      <p className="text-slate-300 text-xs sm:text-sm mb-5 max-w-sm leading-relaxed">
        {userEmail ? (
          <>
            El correo <span className="text-white font-semibold">{userEmail}</span> ha sido validado correctamente.
          </>
        ) : (
          'Tu dirección de correo electrónico ha sido confirmada con éxito.'
        )}
      </p>

      {/* Tarjeta de cuenta regresiva */}
      <div className="w-full bg-slate-950/60 border border-slate-800/90 rounded-2xl p-4 mb-4 text-center">
        <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium mb-1">
          Redirigiendo automáticamente
        </p>
        <p className="text-base sm:text-lg font-bold text-emerald-400">
          Entrando al panel en {countdown}s...
        </p>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-sm sm:text-base shadow-lg shadow-emerald-600/30 border border-emerald-400/30 transition-all duration-200 active:scale-[0.99]"
      >
        <span>Entrar ahora</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

export default SuccessCelebration;
