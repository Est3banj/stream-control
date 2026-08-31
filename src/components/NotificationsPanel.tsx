import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMoneda } from '../hooks/useMoneda';
import { Bell, X, Calendar, AlertCircle } from 'lucide-react';
import useClientesConNotificaciones from '../hooks/useClientesConNotificaciones';
import type { NotificacionDerivada } from '../types/hooks';

export default function NotificationsPanel() {
  const { user } = useAuth();
  const { notificaciones, loading } = useClientesConNotificaciones(user);
  const { formatear } = useMoneda();
  const [mostrarPanel, setMostrarPanel] = useState(false);
  const [notificacionesLeidas, setNotificacionesLeidas] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Cargar notificaciones leídas desde localStorage
  useEffect(() => {
    const leidas: string[] = JSON.parse(localStorage.getItem('notificacionesLeidas') || '[]');
    setNotificacionesLeidas(leidas);
  }, []);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setMostrarPanel(false);
      }
    };

    if (mostrarPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mostrarPanel]);

  const marcarComoLeida = (notifId: string) => {
    const nuevasLeidas = [...notificacionesLeidas, notifId];
    setNotificacionesLeidas(nuevasLeidas);
    localStorage.setItem('notificacionesLeidas', JSON.stringify(nuevasLeidas));
  };

  const marcarTodasComoLeidas = () => {
    const todasLasIds = notificaciones.map((n: NotificacionDerivada) => n.id);
    setNotificacionesLeidas(todasLasIds);
    localStorage.setItem('notificacionesLeidas', JSON.stringify(todasLasIds));
  };

  const notificacionesNoLeidas = notificaciones.filter(
    (n: NotificacionDerivada) => !notificacionesLeidas.includes(n.id)
  );

  const notificacionesNoLeidasCount = notificacionesNoLeidas.length;

  const getColorClasses = (diasRestantes: number) => {
    if (diasRestantes <= 0) {
      return {
        bg: 'bg-rose-950/30 border-l-2 border-rose-500',
        badge: 'bg-rose-950/60 text-rose-400',
        icon: 'text-rose-400',
        text: 'bg-rose-950/50 text-rose-300 border border-rose-800/40',
      };
    } else if (diasRestantes === 1) {
      return {
        bg: 'bg-amber-950/30 border-l-2 border-amber-500',
        badge: 'bg-amber-950/60 text-amber-400',
        icon: 'text-amber-400',
        text: 'bg-amber-950/50 text-amber-300 border border-amber-800/40',
      };
    } else if (diasRestantes === 3) {
      return {
        bg: 'bg-slate-850/60',
        badge: 'bg-slate-800 text-amber-400',
        icon: 'text-amber-400',
        text: 'bg-amber-950/40 text-amber-300 border border-amber-800/30',
      };
    } else {
      return {
        bg: 'bg-slate-850/40',
        badge: 'bg-slate-800 text-indigo-400',
        icon: 'text-indigo-400',
        text: 'bg-indigo-950/40 text-indigo-300 border border-indigo-800/30',
      };
    }
  };

  const getMensaje = (diasRestantes: number) => {
    if (diasRestantes <= 0) {
      return `⚠️ Vencido hace ${Math.abs(diasRestantes)} día(s)`;
    } else if (diasRestantes === 1) {
      return '⚠️ Vence mañana';
    } else {
      return `⚠️ Vence en ${diasRestantes} días`;
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Botón de notificaciones */}
      <button
        onClick={() => setMostrarPanel(!mostrarPanel)}
        className="relative p-2 rounded-lg hover:bg-slate-800/60 transition-colors text-slate-300"
        aria-label="Notificaciones"
      >
        <Bell size={22} className="text-slate-300" />
        {notificacionesNoLeidasCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {notificacionesNoLeidasCount > 9 ? '9+' : notificacionesNoLeidasCount}
          </span>
        )}
      </button>

      {/* Dropdown de notificaciones */}
      {mostrarPanel && (
        <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 max-h-[80vh] flex flex-col animate-slide-down text-slate-100 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Bell className="text-indigo-400" size={20} />
              <h3 className="font-bold text-white">Notificaciones</h3>
              {notificacionesNoLeidasCount > 0 && (
                <span className="px-2 py-0.5 bg-rose-500 text-white text-xs font-semibold rounded-full">
                  {notificacionesNoLeidasCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setMostrarPanel(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Lista de notificaciones */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                <p className="text-slate-400 text-sm mt-2">Cargando...</p>
              </div>
            ) : notificacionesNoLeidas.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={48} className="mx-auto mb-3 text-slate-600" />
                <p className="text-slate-300 font-medium">No hay notificaciones</p>
                <p className="text-slate-500 text-sm mt-1">Te notificaremos cuando haya novedades</p>
              </div>
            ) : (
              <>
                {notificacionesNoLeidas.length > 1 && (
                  <div className="p-3 border-b border-slate-800 bg-slate-950/50">
                    <button
                      onClick={marcarTodasComoLeidas}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      Marcar todas como leídas
                    </button>
                  </div>
                )}
                <div className="divide-y divide-slate-800/80">
                  {notificacionesNoLeidas.map((notif: NotificacionDerivada) => {
                    const colors = getColorClasses(notif.diasRestantes as number);
                    return (
                      <div
                        key={notif.id}
                        className={`p-4 hover:bg-slate-800/50 transition-colors ${colors.bg}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colors.badge}`}>
                            <AlertCircle size={20} className={colors.icon} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="font-semibold text-white text-sm">
                                {notif.nombreCliente}
                              </p>
                              <button
                                onClick={() => marcarComoLeida(notif.id)}
                                className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
                                aria-label="Marcar como leída"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <p className="text-xs text-slate-400 mb-2">
                              <span className="font-medium text-indigo-300">{notif.plataforma}</span>
                            </p>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <Calendar size={12} />
                              <span>
                                {notif.fechaVencimiento
                                  ? new Date(notif.fechaVencimiento).toLocaleDateString('es-CO')
                                  : '—'}
                              </span>
                            </div>
                            {notif.tipo === 'mora' && (
                              <div className="mt-2">
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-rose-950/60 text-rose-300 border border-rose-800/50">
                                  <AlertCircle size={12} />
                                  Debe {formatear(notif.saldoPendiente || 0)}
                                </span>
                              </div>
                            )}
                            <div className="mt-2">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${colors.text}`}>
                                {getMensaje(notif.diasRestantes as number)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
