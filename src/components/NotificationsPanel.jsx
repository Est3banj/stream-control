import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Bell, X, Calendar, AlertCircle } from 'lucide-react';
import useClientesConNotificaciones from '../hooks/useClientesConNotificaciones';

export default function NotificationsPanel() {
  const { user } = useAuth();
  const { notificaciones, loading } = useClientesConNotificaciones(user);
  const [mostrarPanel, setMostrarPanel] = useState(false);
  const [notificacionesLeidas, setNotificacionesLeidas] = useState([]);
  const panelRef = useRef(null);

  // Cargar notificaciones leídas desde localStorage
  useEffect(() => {
    const leidas = JSON.parse(localStorage.getItem('notificacionesLeidas') || '[]');
    setNotificacionesLeidas(leidas);
  }, []);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
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

  const marcarComoLeida = (notifId) => {
    const nuevasLeidas = [...notificacionesLeidas, notifId];
    setNotificacionesLeidas(nuevasLeidas);
    localStorage.setItem('notificacionesLeidas', JSON.stringify(nuevasLeidas));
  };

  const marcarTodasComoLeidas = () => {
    const todasLasIds = notificaciones.map((n) => n.id);
    setNotificacionesLeidas(todasLasIds);
    localStorage.setItem('notificacionesLeidas', JSON.stringify(todasLasIds));
  };

  // Filtrar notificaciones no leídas
  const notificacionesNoLeidas = notificaciones.filter(
    (n) => !notificacionesLeidas.includes(n.id)
  );

  const notificacionesNoLeidasCount = notificacionesNoLeidas.length;

  // Función para obtener el color según días restantes
  const getColorClasses = (diasRestantes) => {
    if (diasRestantes <= 0) {
      return {
        bg: 'bg-red-50/70',
        badge: 'bg-red-100',
        icon: 'text-red-600',
        text: 'bg-red-100 text-red-700',
      };
    } else if (diasRestantes === 1) {
      return {
        bg: 'bg-red-50/50',
        badge: 'bg-red-100',
        icon: 'text-red-600',
        text: 'bg-red-100 text-red-700',
      };
    } else if (diasRestantes === 3) {
      return {
        bg: 'bg-yellow-50/50',
        badge: 'bg-yellow-100',
        icon: 'text-yellow-600',
        text: 'bg-yellow-100 text-yellow-700',
      };
    } else {
      // 5 días
      return {
        bg: 'bg-orange-50/50',
        badge: 'bg-orange-100',
        icon: 'text-orange-600',
        text: 'bg-orange-100 text-orange-700',
      };
    }
  };

  // Función para obtener el mensaje según días restantes
  const getMensaje = (diasRestantes) => {
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
        className="relative p-2 rounded-lg hover:bg-white/20 transition-colors text-gray-700"
        aria-label="Notificaciones"
      >
        <Bell size={22} className="text-gray-700" />
        {notificacionesNoLeidasCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {notificacionesNoLeidasCount > 9 ? '9+' : notificacionesNoLeidasCount}
          </span>
        )}
      </button>

      {/* Dropdown de notificaciones */}
      {mostrarPanel && (
        <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 max-h-[80vh] flex flex-col animate-slide-down">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Bell className="text-indigo-600" size={20} />
              <h3 className="font-bold text-gray-900">Notificaciones</h3>
              {notificacionesNoLeidasCount > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-semibold rounded-full">
                  {notificacionesNoLeidasCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setMostrarPanel(false)}
              className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Cerrar"
            >
              <X size={18} className="text-gray-600" />
            </button>
          </div>

          {/* Lista de notificaciones */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="text-gray-500 text-sm mt-2">Cargando...</p>
              </div>
            ) : notificacionesNoLeidas.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium">No hay notificaciones</p>
                <p className="text-gray-400 text-sm mt-1">Te notificaremos cuando haya novedades</p>
              </div>
            ) : (
              <>
                {notificacionesNoLeidas.length > 1 && (
                  <div className="p-3 border-b border-gray-100 bg-gray-50">
                    <button
                      onClick={marcarTodasComoLeidas}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Marcar todas como leídas
                    </button>
                  </div>
                )}
                <div className="divide-y divide-gray-100">
                  {notificacionesNoLeidas.map((notif) => {
                    const colors = getColorClasses(notif.diasRestantes);
                    return (
                      <div
                        key={notif.id}
                        className={`p-4 hover:bg-indigo-50/30 transition-colors ${colors.bg}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colors.badge}`}>
                            <AlertCircle size={20} className={colors.icon} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="font-semibold text-gray-900 text-sm">
                                {notif.nombreCliente}
                              </p>
                              <button
                                onClick={() => marcarComoLeida(notif.id)}
                                className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                                aria-label="Marcar como leída"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <p className="text-xs text-gray-600 mb-2">
                              <span className="font-medium">{notif.plataforma}</span>
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Calendar size={12} />
                              <span>
                                {notif.fechaVencimiento
                                  ? new Date(notif.fechaVencimiento).toLocaleDateString('es-CO')
                                  : '—'}
                              </span>
                            </div>
                            {notif.tipo === 'mora' && (
                              <div className="mt-2">
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                  <AlertCircle size={12} />
                                  Debe ${notif.saldoPendiente?.toLocaleString()}
                                </span>
                              </div>
                            )}
                            <div className="mt-1">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${colors.text}`}>
                                {getMensaje(notif.diasRestantes)}
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
