import React, { useState, useEffect } from 'react';
import { motion, type Variants } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

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
  hidden: { scale: 0.5, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
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
      transition={{ duration: 0.4 }}
      className={`flex flex-col items-center text-center ${className}`}
    >
      {/* Icono de Check Animado con ondas verdes */}
      <div className="relative mb-6">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute -inset-3 rounded-full bg-emerald-500/20 blur-sm pointer-events-none"
        />

        <motion.div
          variants={circleVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-xl shadow-emerald-900/40 border border-emerald-300/30"
        >
          <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="none">
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

      <div className="flex items-center justify-center gap-1.5 mb-2 text-emerald-300 text-sm font-medium">
        <Sparkles className="w-4 h-4" />
        <span>¡Verificación confirmada!</span>
      </div>

      <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-2">
        ¡Tu cuenta está lista!
      </h2>

      <p className="text-white/70 text-sm mb-6 max-w-sm">
        {userEmail ? (
          <>
            El correo <span className="text-white font-medium">{userEmail}</span> ha sido validado correctamente.
          </>
        ) : (
          'Tu dirección de correo electrónico ha sido confirmada con éxito.'
        )}
      </p>

      {/* Tarjeta de cuenta regresiva y botón de entrada rápida */}
      <div className="w-full bg-white/10 border border-white/15 rounded-2xl p-4 mb-4 backdrop-blur-sm">
        <p className="text-xs uppercase tracking-wider text-white/50 mb-1">
          Redirigiendo automáticamente
        </p>
        <p className="text-lg font-bold text-emerald-300">
          Entrando al panel en {countdown}s...
        </p>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-teal-600 hover:to-emerald-500 text-white font-bold text-lg shadow-lg shadow-emerald-600/30 transition-all duration-300 active:scale-[0.99]"
      >
        <span>Entrar ahora</span>
        <ArrowRight className="w-5 h-5" />
      </button>
    </motion.div>
  );
};

export default SuccessCelebration;
