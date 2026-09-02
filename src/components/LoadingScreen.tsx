import React from 'react';

export interface LoadingScreenProps {
  mensaje?: string;
  minHeight?: string;
  className?: string;
}

export default function LoadingScreen({
  mensaje = 'Cargando...',
  minHeight = 'min-h-[60vh]',
  className = '',
}: LoadingScreenProps) {
  return (
    <div
      className={`flex items-center justify-center ${minHeight} ${className}`.trim()}
    >
      <div className="text-center flex flex-col items-center">
        <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 border-r-cyan-400 animate-spin" />
        {mensaje && (
          <p className="text-slate-400 font-medium text-sm tracking-wide mt-4">
            {mensaje}
          </p>
        )}
      </div>
    </div>
  );
}

export { LoadingScreen };
