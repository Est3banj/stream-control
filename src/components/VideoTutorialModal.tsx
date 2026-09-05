import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Play, CheckCircle2, Clock, ArrowRight, Video, Sparkles } from 'lucide-react';
import type { Tutorial } from '../data/tutoriales';

interface VideoTutorialModalProps {
  tutorial: Tutorial | null;
  onClose: () => void;
}

export default function VideoTutorialModal({ tutorial, onClose }: VideoTutorialModalProps) {
  let navigate: ((to: string) => void) | null = null;
  try {
    navigate = useNavigate();
  } catch {
    navigate = null;
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (tutorial) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [tutorial, handleKeyDown]);

  if (!tutorial) return null;

  const hasValidVideo =
    Boolean(tutorial.youtubeId) &&
    tutorial.youtubeId.trim() !== '' &&
    tutorial.youtubeId !== 'placeholder';

  const handleNavigate = () => {
    onClose();
    if (navigate) {
      navigate(tutorial.urlDestino);
    } else if (typeof window !== 'undefined') {
      window.location.href = tutorial.urlDestino;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-6 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-modal-title"
    >
      <div
        className="relative w-full max-w-3xl bg-slate-900/95 border border-slate-800 rounded-3xl backdrop-blur-2xl shadow-2xl p-4 sm:p-7 text-slate-100 animate-scale-in my-auto max-h-[92vh] flex flex-col overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-cyan-300 border border-indigo-500/30">
                <Video size={13} className="text-cyan-400" />
                {tutorial.badge}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                <Clock size={12} className="text-slate-400" />
                {tutorial.duracionEstimada}
              </span>
            </div>
            <h2 id="video-modal-title" className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
              {tutorial.titulo}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 line-clamp-2 sm:line-clamp-none leading-relaxed">
              {tutorial.descripcion}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Video Player Container (16:9) */}
        <div className="aspect-video w-full rounded-xl sm:rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 relative mb-4 sm:mb-6 shadow-inner flex items-center justify-center min-h-[180px]">
          {hasValidVideo ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${tutorial.youtubeId}?rel=0&modestbranding=1&autoplay=1`}
              title={tutorial.titulo}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-slate-900/60 via-slate-950 to-slate-950 overflow-hidden select-none">
              {/* Decorative radial glows */}
              <div className="absolute w-72 h-72 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none -top-10 -left-10" />
              <div className="absolute w-72 h-72 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none -bottom-10 -right-10" />

              {/* Central Glowing Play Icon */}
              <div className="relative mb-4 group cursor-pointer">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 p-0.5 shadow-xl shadow-indigo-950/60 transition-transform group-hover:scale-105">
                  <div className="w-full h-full bg-slate-950/80 backdrop-blur rounded-2xl flex items-center justify-center text-cyan-300">
                    <Play size={28} className="fill-cyan-400 translate-x-0.5" />
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-2">
                <Sparkles size={13} className="text-cyan-300 animate-pulse" />
                <span>Video tutorial oficial — Próximamente disponible</span>
              </div>
              <p className="text-xs text-slate-400 max-w-md">
                Mientras se procesa la producción audiovisual en alta definición, podés seguir el paso a paso detallado a continuación.
              </p>
            </div>
          )}
        </div>

        {/* Pasos Clave Checklist */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 mb-6 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Guía Paso a Paso
            </h3>
          </div>
          <div className="space-y-2.5">
            {tutorial.pasosClave.map((paso, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/40 text-xs sm:text-sm text-slate-300 transition-colors hover:bg-slate-900/80"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {index + 1}
                </div>
                <span className="leading-relaxed flex-1">{paso}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleNavigate}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white shadow-lg shadow-indigo-950/50 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <span>{tutorial.botonTexto}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
