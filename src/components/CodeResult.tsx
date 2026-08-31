import React, { useState } from 'react';
import { Copy, Check, Clock, Mail, Tag, ExternalLink, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { CASE_LABELS } from './CasoSelector';
import { maskEmail } from '../constants';

interface CodeResultProps {
  code: string;
  email: string;
  fecha: string;
  tipo: string;
  expiraEn?: number;
}

export default function CodeResult({ code, email, fecha, tipo, expiraEn }: CodeResultProps) {
  const [copied, setCopied] = useState(false);
  const [showFullEmail, setShowFullEmail] = useState(false);
  const isLink = tipo === 'link' || code.startsWith('http');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // VISTA PARA LINK
  if (isLink) {
    return (
      <div className="space-y-6 animate-fade-in text-slate-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 mb-3 shadow-lg shadow-amber-950/30">
            <ExternalLink className="text-amber-400" size={28} />
          </div>
          <p className="text-sm text-slate-400 mb-2">Enlace de código temporal</p>
          <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800 break-all">
            <a
              href={code}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 hover:underline text-sm font-mono"
            >
              {code}
            </a>
          </div>
          {expiraEn && (
            <p className="text-amber-400 text-xs mt-2 flex items-center justify-center gap-1">
              <AlertTriangle size={14} />
              Este enlace vence en {expiraEn} minutos
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <a
            href={code}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-all shadow-lg shadow-amber-950/40"
          >
            <ExternalLink size={18} />
            Abrir enlace
          </a>
          <button
            onClick={handleCopy}
            className={`flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border transition-all ${
              copied
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? 'Copiado' : 'Copiar enlace'}
          </button>
        </div>

        <div className="space-y-3 bg-slate-950/60 rounded-xl p-4 border border-slate-800">
          <div className="flex items-center gap-3 text-sm">
            <Mail size={16} className="text-slate-400 shrink-0" />
            <span className="text-slate-200">{showFullEmail ? email : maskEmail(email)}</span>
            <button
              onClick={() => setShowFullEmail(!showFullEmail)}
              className="ml-auto text-slate-400 hover:text-slate-200 transition-colors"
              title={showFullEmail ? 'Ocultar correo' : 'Ver correo completo'}
            >
              {showFullEmail ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Clock size={16} className="text-slate-400 shrink-0" />
            <span className="text-slate-300">
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
            <Tag size={16} className="text-slate-400 shrink-0" />
            <span className="text-slate-300">{CASE_LABELS[tipo] || tipo}</span>
          </div>
        </div>
      </div>
    );
  }

  // VISTA PARA CODIGO NUMERICO
  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      <div className="text-center">
        <p className="text-sm text-slate-400 mb-2">Código de verificación</p>
        <div className="relative inline-block">
          <div className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-[0.2em] text-amber-400 select-all font-mono animate-scale-in">
            {code}
          </div>
          <div className="absolute -inset-4 bg-amber-400/10 blur-3xl rounded-full pointer-events-none" />
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleCopy}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
            copied
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-400/15 text-amber-300 border border-amber-400/30 hover:bg-amber-400/25 shadow-lg shadow-amber-950/30'
          }`}
        >
          {copied ? <Check size={20} /> : <Copy size={20} />}
          {copied ? 'Copiado' : 'Copiar código'}
        </button>
      </div>

      <div className="space-y-3 bg-slate-950/60 rounded-xl p-4 border border-slate-800">
        <div className="flex items-center gap-3 text-sm">
          <Mail size={16} className="text-slate-400 shrink-0" />
          <span className="text-slate-200">{showFullEmail ? email : maskEmail(email)}</span>
          <button
            onClick={() => setShowFullEmail(!showFullEmail)}
            className="ml-auto text-slate-400 hover:text-slate-200 transition-colors"
            title={showFullEmail ? 'Ocultar correo' : 'Ver correo completo'}
          >
            {showFullEmail ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Clock size={16} className="text-slate-400 shrink-0" />
          <span className="text-slate-300">
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
          <Tag size={16} className="text-slate-400 shrink-0" />
          <span className="text-slate-300">{CASE_LABELS[tipo] || tipo}</span>
        </div>
      </div>
    </div>
  );
}
