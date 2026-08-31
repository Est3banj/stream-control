import React from 'react';

export function parsePlataformas(plataforma: string): string[] {
  if (!plataforma || typeof plataforma !== 'string') return [];
  // Divide por '+' o ',' eliminando espacios en blanco y elementos vacíos
  return plataforma
    .split(/[+,]/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

interface PlataformaBadgeProps {
  plataforma: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getEstiloPlataforma(nombre: string): string {
  const norm = nombre.toLowerCase().trim();

  if (norm.includes('netflix')) {
    return 'bg-red-950/50 text-red-400 border-red-800/50';
  }
  if (norm.includes('disney')) {
    return 'bg-blue-950/50 text-blue-400 border-blue-800/50';
  }
  if (norm.includes('max') || norm.includes('hbo')) {
    return 'bg-purple-950/50 text-purple-400 border-purple-800/50';
  }
  if (norm.includes('prime') || norm.includes('amazon')) {
    return 'bg-sky-950/50 text-sky-400 border-sky-800/50';
  }
  if (norm.includes('spotify')) {
    return 'bg-emerald-950/50 text-emerald-400 border-emerald-800/50';
  }
  if (norm.includes('crunchyroll')) {
    return 'bg-orange-950/50 text-orange-400 border-orange-800/50';
  }
  if (norm.includes('chatgpt') || norm.includes('openai')) {
    return 'bg-teal-950/50 text-teal-400 border-teal-800/50';
  }
  if (norm.includes('magis') || norm.includes('iptv') || norm.includes('plex')) {
    return 'bg-indigo-950/50 text-indigo-400 border-indigo-800/50';
  }
  if (norm.includes('win')) {
    return 'bg-amber-950/50 text-amber-400 border-amber-800/50';
  }
  if (norm.includes('canva')) {
    return 'bg-rose-950/50 text-rose-400 border-rose-800/50';
  }
  if (norm.includes('paramount') || norm.includes('universal') || norm.includes('vix')) {
    return 'bg-cyan-950/50 text-cyan-400 border-cyan-800/50';
  }

  return 'bg-slate-800 text-slate-300 border-slate-700';
}

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

export default function PlataformaBadge({
  plataforma,
  size = 'md',
  className = '',
}: PlataformaBadgeProps) {
  const lista = parsePlataformas(plataforma);

  if (lista.length === 0) {
    return <span className="text-slate-500 text-sm">—</span>;
  }

  if (lista.length === 1) {
    const estilo = getEstiloPlataforma(lista[0]);
    return (
      <span
        className={`inline-flex items-center font-medium rounded-full border ${SIZE_CLASSES[size]} ${estilo} ${className}`}
      >
        {lista[0]}
      </span>
    );
  }

  return (
    <div className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {lista.map((item, idx) => {
        const estilo = getEstiloPlataforma(item);
        return (
          <span
            key={`${item}-${idx}`}
            className={`inline-flex items-center font-medium rounded-full border ${SIZE_CLASSES[size]} ${estilo}`}
          >
            {item}
          </span>
        );
      })}
    </div>
  );
}
