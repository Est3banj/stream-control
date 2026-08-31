import React from 'react';
import { motion } from 'framer-motion';

interface AuthLayoutProps {
  children: React.ReactNode;
  subtitle?: string;
  badge?: string;
  maxWidth?: string;
  footerText?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  subtitle,
  badge,
  maxWidth = 'max-w-md',
  footerText = '© StreamControl Pro — Plataforma de Gestión de Streaming',
}) => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative bg-slate-950 text-slate-100 font-sans overflow-hidden px-4 py-8 selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Luces y degradados ambientales sutiles estilo SaaS moderno */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Rejilla sutil de fondo */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none"
      />

      <div className={`relative z-10 w-full ${maxWidth} flex flex-col items-center`}>
        {/* Isotipo & Branding */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center mb-6 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-transparent border border-indigo-500/30 p-2.5 shadow-xl shadow-indigo-950/50 backdrop-blur-md flex items-center justify-center mb-3">
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
            <h1 className="text-2xl font-bold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
              StreamControl Pro
            </h1>
            {badge && (
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-full">
                {badge}
              </span>
            )}
          </div>

          {subtitle && (
            <p className="text-xs text-slate-400 mt-1 max-w-xs font-normal leading-relaxed">
              {subtitle}
            </p>
          )}
        </motion.div>

        {/* Tarjeta Glassmorphic SaaS */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full relative bg-slate-900/75 backdrop-blur-xl border border-slate-800/80 rounded-3xl shadow-2xl shadow-black/60 p-6 sm:p-8 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-indigo-500/30 before:to-transparent"
        >
          {children}
        </motion.div>

        {/* Footer */}
        <footer className="mt-8 text-xs text-slate-500 select-none font-light tracking-wide text-center">
          {footerText}
        </footer>
      </div>
    </div>
  );
};

export default AuthLayout;
