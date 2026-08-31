import React, { useState, useEffect } from 'react';
import { useBroadcastBanner } from '../hooks/useBroadcastBanner';
import { Info, AlertTriangle, AlertOctagon, Megaphone, X } from 'lucide-react';

export default function BroadcastBanner() {
  const { broadcast, loading } = useBroadcastBanner();
  const [dismissed, setDismissed] = useState(false);

  const isActive = Boolean(broadcast.activo || broadcast.active);
  const message = broadcast.mensaje || broadcast.message || '';
  const type = broadcast.tipo || broadcast.type || 'info';

  // Reset dismissed state if message changes
  useEffect(() => {
    if (message) {
      try {
        const dismissedKey = `dismissed_broadcast_${message.substring(0, 30)}`;
        if (sessionStorage.getItem(dismissedKey)) {
          setDismissed(true);
        } else {
          setDismissed(false);
        }
      } catch {
        setDismissed(false);
      }
    }
  }, [message]);

  if (loading || !isActive || !message || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    try {
      const dismissedKey = `dismissed_broadcast_${message.substring(0, 30)}`;
      sessionStorage.setItem(dismissedKey, 'true');
    } catch {
      // fallback
    }
    setDismissed(true);
  };

  const getStyleAndIcon = () => {
    switch (type) {
      case 'warning':
        return {
          wrapper: 'bg-amber-950/90 border-b border-amber-500/40 text-amber-200',
          iconContainer: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
          icon: <AlertTriangle size={18} className="shrink-0 text-amber-400" />,
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          badgeText: 'AVISO',
        };
      case 'critical':
      case 'alerta':
        return {
          wrapper: 'bg-rose-950/90 border-b border-rose-500/40 text-rose-200',
          iconContainer: 'text-rose-400 bg-rose-500/20 border-rose-500/30',
          icon: <AlertOctagon size={18} className="shrink-0 text-rose-400 animate-pulse" />,
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          badgeText: 'URGENTE',
        };
      case 'info':
      default:
        return {
          wrapper: 'bg-indigo-950/90 border-b border-indigo-500/40 text-indigo-200',
          iconContainer: 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30',
          icon: <Megaphone size={18} className="shrink-0 text-cyan-400" />,
          badge: 'bg-indigo-500/20 text-cyan-300 border-indigo-500/30',
          badgeText: 'ANUNCIO',
        };
    }
  };

  const { wrapper, iconContainer, icon, badge, badgeText } = getStyleAndIcon();

  return (
    <div className={`relative z-40 px-4 py-2.5 backdrop-blur-md transition-all duration-300 ${wrapper}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${iconContainer}`}>
            {icon}
          </div>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border tracking-wider uppercase ${badge}`}>
              {badgeText}
            </span>
            <p className="font-medium text-slate-100 truncate sm:whitespace-normal">
              {message}
            </p>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
          aria-label="Cerrar anuncio"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
