import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { Mail, RefreshCw } from 'lucide-react';

interface RadarPingProps {
  isChecking?: boolean;
  className?: string;
}

export const ringVariants: Variants = {
  initial: { scale: 0.8, opacity: 0.8 },
  animate: (custom: number) => ({
    scale: [0.8, 2.2],
    opacity: [0.8, 0],
    transition: {
      duration: 2.4,
      repeat: Infinity,
      ease: 'easeOut',
      delay: custom * 0.7,
    },
  }),
};

export const RadarPing: React.FC<RadarPingProps> = ({ isChecking = false, className = '' }) => {
  return (
    <div className={`relative flex items-center justify-center w-36 h-36 mx-auto ${className}`}>
      {/* 3 Ondas concéntricas de radar */}
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          custom={index}
          variants={ringVariants}
          initial="initial"
          animate="animate"
          className="absolute inset-0 rounded-full border border-indigo-500/30 bg-indigo-500/10 pointer-events-none"
        />
      ))}

      {/* Resplandor ambiental de fondo */}
      <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-indigo-500/20 via-violet-500/20 to-purple-500/15 blur-md pointer-events-none" />

      {/* Núcleo central */}
      <motion.div
        animate={{
          scale: isChecking ? [1, 1.06, 1] : 1,
          boxShadow: isChecking
            ? '0 0 25px rgba(99, 102, 241, 0.5)'
            : '0 0 15px rgba(99, 102, 241, 0.25)',
        }}
        transition={{ duration: 0.8, repeat: isChecking ? Infinity : 0 }}
        className="relative z-10 w-18 h-18 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 flex items-center justify-center shadow-xl border border-indigo-400/40 text-white"
      >
        {isChecking ? (
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-100" />
        ) : (
          <Mail className="w-8 h-8 text-indigo-100 drop-shadow" />
        )}
      </motion.div>
    </div>
  );
};

export default RadarPing;
