import React, { useState } from 'react';
import { Copy, Check, Clock, Mail, Tag } from 'lucide-react';

interface CodeResultProps {
  code: string;
  email: string;
  fecha: string;
  tipo: string;
}

const CASE_LABELS: Record<string, string> = {
  viajenet: 'Netflix - Estoy de viaje',
  hogarnet: 'Netflix - Código Hogar',
  resetnet: 'Netflix - Cambiar contraseña',
  ininet: 'Netflix - Código inicio sesión',
  wincode: 'Win - Código',
  cgptcode: 'Tools - ChatGPT Code',
  univer1: 'Universal - código',
  accmax: 'Max - código acceso',
};

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const masked = local.charAt(0) + '*'.repeat(Math.max(local.length - 2, 1)) + local.charAt(local.length - 1);
  return `${masked}@${domain}`;
}

export default function CodeResult({ code, email, fecha, tipo }: CodeResultProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <p className="text-sm text-gray-400 mb-2">Código de verificación</p>
        <div className="relative inline-block">
          <div className="text-5xl sm:text-6xl font-bold tracking-[0.2em] text-[#ffc62a] select-all font-mono">
            {code}
          </div>
          <div className="absolute -inset-4 bg-[#ffc62a]/5 blur-3xl rounded-full pointer-events-none" />
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleCopy}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
            copied
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-[#ffc62a]/10 text-[#ffc62a] border border-[#ffc62a]/30 hover:bg-[#ffc62a]/20'
          }`}
        >
          {copied ? <Check size={20} /> : <Copy size={20} />}
          {copied ? 'Copiado' : 'Copiar código'}
        </button>
      </div>

      <div className="space-y-3 bg-white/5 rounded-xl p-4 border border-white/10">
        <div className="flex items-center gap-3 text-sm">
          <Mail size={16} className="text-gray-500 shrink-0" />
          <span className="text-gray-300">{maskEmail(email)}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Clock size={16} className="text-gray-500 shrink-0" />
          <span className="text-gray-300">
            {new Date(fecha).toLocaleDateString('es-CO', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Tag size={16} className="text-gray-500 shrink-0" />
          <span className="text-gray-300">{CASE_LABELS[tipo] || tipo}</span>
        </div>
      </div>
    </div>
  );
}

export { maskEmail };
