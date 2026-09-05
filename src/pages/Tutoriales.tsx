import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Play,
  Clock,
  ArrowRight,
  ExternalLink,
  Video,
  DollarSign,
  Users,
  CreditCard,
  UserPlus,
  Send,
  Sparkles,
  Layers,
  BookOpen,
} from 'lucide-react';
import { TUTORIALES, type Tutorial } from '../data/tutoriales';
import VideoTutorialModal from '../components/VideoTutorialModal';

type FiltroTab = 'Todos' | 'Ventas & CRM' | 'Automatización IMAP' | 'Mayoristas' | 'Telegram';

const TABS: FiltroTab[] = [
  'Todos',
  'Ventas & CRM',
  'Automatización IMAP',
  'Mayoristas',
  'Telegram',
];

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  DollarSign,
  Users,
  CreditCard,
  UserPlus,
  Send,
};

export default function Tutoriales() {
  const navigate = useNavigate();
  const [filtroActivo, setFiltroActivo] = useState<FiltroTab>('Todos');
  const [tutorialSeleccionado, setTutorialSeleccionado] = useState<Tutorial | null>(null);

  const tutorialesFiltrados = useMemo(() => {
    return TUTORIALES.filter((t) => {
      switch (filtroActivo) {
        case 'Ventas & CRM':
          return t.categoria === 'ventas' || t.categoria === 'clientes';
        case 'Automatización IMAP':
          return t.categoria === 'cuentas';
        case 'Mayoristas':
          return t.categoria === 'mayoristas';
        case 'Telegram':
          return t.categoria === 'telegram';
        case 'Todos':
        default:
          return true;
      }
    });
  }, [filtroActivo]);

  return (
    <div className="space-y-8 animate-fade-in text-slate-100">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950/70 via-slate-900/90 to-slate-900/90 border border-indigo-500/20 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -top-10 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-cyan-300 border border-indigo-500/30">
              <GraduationCap size={15} className="text-cyan-400" />
              <span>Centro de Capacitación Oficial</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300 tracking-tight">
              Academia & Guías en Video
            </h1>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              Dominá todas las herramientas de automatización, ventas y cobranza de StreamControl Pro.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 shrink-0">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-cyan-300">
              <BookOpen size={24} />
            </div>
            <div>
              <div className="text-2xl font-black text-white">{TUTORIALES.length}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Guías Maestras
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {TABS.map((tab) => {
          const isActive = filtroActivo === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setFiltroActivo(tab)}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/50 border border-indigo-500/40'
                  : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Tutorials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tutorialesFiltrados.map((tutorial) => {
          const IconComponent = ICON_MAP[tutorial.icono] || Video;

          return (
            <div
              key={tutorial.id}
              className="group flex flex-col bg-slate-900/80 border border-slate-800/80 rounded-3xl overflow-hidden hover:border-slate-700/80 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-950/30 hover:-translate-y-1"
            >
              {/* Thumbnail preview with play overlay */}
              <div
                className="relative aspect-video w-full bg-slate-950 overflow-hidden cursor-pointer flex items-center justify-center border-b border-slate-800/80"
                onClick={() => setTutorialSeleccionado(tutorial)}
              >
                {/* Visual Background */}
                {tutorial.youtubeId && tutorial.youtubeId.trim() !== '' ? (
                  <>
                    <img
                      src={`https://img.youtube.com/vi/${tutorial.youtubeId}/hqdefault.jpg`}
                      alt={tutorial.titulo}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/60" />
                    <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[0.5px]" />
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-slate-950 to-slate-900/90 group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/15 transition-colors" />
                  </>
                )}

                {/* Top Badges */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-900/90 text-cyan-300 border border-slate-700/80 backdrop-blur-md">
                    <IconComponent size={12} className="text-cyan-400" />
                    {tutorial.badge}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-950/90 text-slate-300 border border-slate-800 backdrop-blur-md">
                    <Clock size={11} className="text-slate-400" />
                    {tutorial.duracionEstimada}
                  </span>
                </div>

                {/* Play Button Overlay */}
                <div className="relative z-10 w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 p-0.5 shadow-xl shadow-black/60 transition-transform duration-300 group-hover:scale-110">
                  <div className="w-full h-full bg-slate-950/80 backdrop-blur rounded-2xl flex items-center justify-center text-cyan-300 group-hover:text-white transition-colors">
                    <Play size={22} className="fill-current translate-x-0.5" />
                  </div>
                </div>

                <div className="absolute bottom-2 z-10 text-[11px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity font-medium bg-slate-950/70 px-2.5 py-0.5 rounded-full border border-slate-700/50 backdrop-blur-sm">
                  Clic para ver video tutorial
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-cyan-300 transition-colors leading-snug">
                    {tutorial.titulo}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed line-clamp-3">
                    {tutorial.descripcion}
                  </p>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTutorialSeleccionado(tutorial)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600/20 hover:bg-indigo-600/30 text-cyan-300 border border-indigo-500/30 transition-all hover:scale-[1.01] cursor-pointer"
                  >
                    <Play size={13} className="fill-cyan-400" />
                    <span>Ver Video Tutorial</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(tutorial.urlDestino)}
                    title="Ir al Módulo"
                    className="p-2.5 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors cursor-pointer"
                    aria-label={`Ir al módulo de ${tutorial.titulo}`}
                  >
                    <ExternalLink size={15} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      <VideoTutorialModal
        tutorial={tutorialSeleccionado}
        onClose={() => setTutorialSeleccionado(null)}
      />
    </div>
  );
}
