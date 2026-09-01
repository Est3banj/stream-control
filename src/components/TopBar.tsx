import React from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import NotificationsPanel from './NotificationsPanel';

interface TopBarProps {
  onMenuToggle: () => void;
}

/**
 * TopBar unificado responsive.
 * - Mobile (< lg): logo + notifications + hamburger
 * - Desktop (≥ lg): solo notifications (el logo vive en el sidebar)
 */
export default function TopBar({ onMenuToggle }: TopBarProps) {
  return (
    <>
      {/* ── Mobile Top Header (< lg) ── */}
      <header className="h-14 px-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md lg:hidden sticky top-0 z-30">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-center p-1">
            <img
              src="/app/stream.webp"
              alt="StreamControl"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.endsWith('/stream.webp') || target.src.includes('/app/stream.webp')) {
                  target.src = '/stream.webp';
                }
              }}
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
            StreamControl <span className="text-indigo-400">Pro</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <NotificationsPanel />
          <button
            onClick={onMenuToggle}
            className="p-2 rounded-xl hover:bg-slate-800/60 text-slate-300 transition-colors"
            aria-label="Abrir menú"
          >
            <Menu size={22} className="text-slate-300" />
          </button>
        </div>
      </header>

      {/* ── Desktop Top Bar (≥ lg) ── */}
      <header className="hidden lg:flex items-center justify-end px-8 py-3 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <NotificationsPanel />
        </div>
      </header>
    </>
  );
}
