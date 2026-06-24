import React from 'react';

export const CASE_OPTIONS = [
  { value: 'viajenet', label: 'Netflix - Estoy de viaje' },
  { value: 'hogarnet', label: 'Netflix - Código Hogar' },
  { value: 'resetnet', label: 'Netflix - Cambiar contraseña' },
  { value: 'ininet', label: 'Netflix - Código inicio sesión' },
  { value: 'wincode', label: 'Win - Código' },
  { value: 'cgptcode', label: 'Tools - ChatGPT Code' },
  { value: 'univer1', label: 'Universal - código' },
  { value: 'accmax', label: 'Max - código acceso' },
];

export const CASE_LABELS: Record<string, string> = Object.fromEntries(
  CASE_OPTIONS.map(o => [o.value, o.label])
);

interface CasoSelectorProps {
  casos: string[];
  selected: string;
  onSelect: (value: string) => void;
}

export default function CasoSelector({ casos, selected, onSelect }: CasoSelectorProps) {
  const filtered = CASE_OPTIONS.filter(opt => casos.includes(opt.value));

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-300">
        Seleccioná el tipo de código
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            className={`p-4 rounded-xl text-left transition-all border ${
              selected === value
                ? 'border-[#ffc62a] bg-[#ffc62a]/10 text-[#ffc62a]'
                : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <span className="text-sm font-medium leading-tight">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
