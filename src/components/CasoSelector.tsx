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

export const CASE_LABELS: Record<string, string> = {
  ...Object.fromEntries(CASE_OPTIONS.map(o => [o.value, o.label])),
  link: 'Enlace temporal',
  numerico: 'Código de verificación',
};

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
        Selecciona un caso
      </label>
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 text-sm appearance-none cursor-pointer focus:outline-none focus:border-[#ffc62a]/50 transition-colors"
      >
        <option value="" disabled>Selecciona un caso</option>
        {filtered.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </div>
  );
}
