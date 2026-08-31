import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Menu, LayoutDashboard, DollarSign, BarChart3, Users, UserPlus, UserCog, LogOut, User, Download, MessageCircle, Package, ClipboardList, Send, Settings, CreditCard, Key } from 'lucide-react';
import PWAInstallButton from './PWAInstallButton';
import NotificationsPanel from './NotificationsPanel';
import UpgradeModal from './UpgradeModal';
import UpgradeModalContext from '../contexts/UpgradeModalContext';
import usePermisos from '../hooks/usePermisos';
import { useAdminConfig, sanitizarWhatsApp } from '../hooks/useAdminConfig';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const permisos = usePermisos(user);
  const { config } = useAdminConfig();
  const whatsappNumber = config.whatsapp ? sanitizarWhatsApp(config.whatsapp) : '';
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mostrarUpgrade, setMostrarUpgrade] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem('upgrade_modal_shown')) {
        setMostrarUpgrade(true);
      }
    } catch {
      setMostrarUpgrade(true);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cerrar sidebar al cambiar de ruta en móvil
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [location, isMobile]);

  const navItems: { to: string; icon: React.ComponentType<{ size?: number; className?: string }>; label: string }[] = user?.rol === 'admin'
    ? [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/cuentas', icon: CreditCard, label: 'Cuentas' },
        { to: '/mayoristas', icon: UserPlus, label: 'Mayoristas' },
        { to: '/admin/planes', icon: Package, label: 'Planes' },
        { to: '/admin/suscripciones', icon: ClipboardList, label: 'Suscripciones' },
        { to: '/usuarios', icon: UserCog, label: 'Usuarios' },
        { to: '/telegram', icon: Send, label: 'Telegram' },
        { to: '/consulta-codigos', icon: Key, label: 'Códigos' },
        { to: '/ajustes', icon: Settings, label: 'Ajustes' },
      ]
    : [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/ventas', icon: DollarSign, label: 'Ventas' },
        { to: '/reportes', icon: BarChart3, label: 'Reportes' },
        { to: '/gestion-clientes', icon: Users, label: 'Clientes' },
        { to: '/cuentas', icon: CreditCard, label: 'Cuentas' },
        { to: '/mayoristas', icon: UserPlus, label: 'Mayoristas' },
        { to: '/consulta-codigos', icon: Key, label: 'Códigos' },
        { to: '/ajustes', icon: Settings, label: 'Ajustes' },
      ];

  const isActive = (path: string) => location.pathname === path;

  const upgradeModalContextValue = { show: () => setMostrarUpgrade(true) };

  return (
    <UpgradeModalContext.Provider value={upgradeModalContextValue}>
      <div className="flex flex-col lg:flex-row min-h-screen font-inter bg-slate-950 text-slate-100 relative overflow-hidden">
        {/* Ambient Radial Lights */}
        <div className="w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none absolute -top-40 -left-40 z-0" />
        <div className="w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none absolute -bottom-40 -right-40 z-0" />

        {/* Overlay para móvil */}
        {sidebarOpen && isMobile && (
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-50
            w-64 p-6
            bg-slate-900/90 backdrop-blur-xl border-r border-slate-800/80
            text-slate-200 shadow-2xl
            flex flex-col justify-between
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          {/* Header del sidebar */}
          <div>
            <div className="flex items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center p-1.5 shadow-inner">
                  <img 
                    src="/app/stream.webp" 
                    alt="StreamControl" 
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.src.endsWith('/stream.webp') || target.src.includes('/app/stream.webp')) {
                        target.src = '/stream.webp';
                      }
                    }}
                    className="w-full h-full object-contain drop-shadow-lg" 
                  />
                </div>
                <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300 tracking-wide">
                  StreamControl <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Pro</span>
                </div>
              </div>
            </div>

            {/* Navegación */}
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => isMobile && setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl
                      transition-all duration-200
                      ${active
                        ? 'bg-indigo-600/20 text-cyan-300 border border-indigo-500/30 shadow-lg shadow-indigo-950/40 scale-105'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 hover:translate-x-1'
                      }
                    `}
                  >
                    <Icon size={20} className={active ? 'text-cyan-300' : ''} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
              
              {/* Botón de instalación PWA en sidebar */}
              <div className="mt-2 pt-2 border-t border-slate-800/80">
                <PWAInstallButton showInSidebar={true} />
              </div>

              {/* Configuración */}
              {user?.rol !== 'admin' && (
                <div className="mt-2 pt-2 border-t border-slate-800/80">
                  <Link
                    to="/telegram"
                    onClick={() => isMobile && setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive('/telegram')
                        ? 'bg-indigo-600/20 text-cyan-300 border border-indigo-500/30 shadow-lg shadow-indigo-950/40 scale-105'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 hover:translate-x-1'
                    }`}
                  >
                    <MessageCircle size={20} className={isActive('/telegram') ? 'text-cyan-300' : ''} />
                    <span className="font-medium">Telegram</span>
                  </Link>
                </div>
              )}
            </nav>
          </div>

          {/* Información del usuario */}
          <div className="mt-8 border-t border-slate-800/80 pt-4 space-y-3">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700/60 text-slate-300 flex items-center justify-center">
                <User size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-400 truncate">Conectado como</div>
                <div className="text-sm font-semibold text-slate-200 truncate">{user?.email}</div>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 bg-slate-800/60 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-800/40 border border-slate-700/50 text-slate-300 px-4 py-2.5 rounded-xl transition-all font-medium"
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </div>
        </aside>

        {/* Contenido principal */}
        <main className="flex-1 lg:ml-0 min-h-screen relative z-10 flex flex-col">
          {/* Header superior */}
          <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 py-3 lg:py-4 flex items-center justify-between text-slate-100">
            {/* Logo/Título - Solo móvil */}
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-center p-1">
                <img 
                  src="/app/stream.webp" 
                  alt="" 
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.endsWith('/stream.webp') || target.src.includes('/app/stream.webp')) {
                      target.src = '/stream.webp';
                    }
                  }}
                  className="w-full h-full object-contain" 
                />
              </div>
              <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
                StreamControl <span className="text-indigo-400">Pro</span>
              </span>
            </div>
            
            {/* Spacer para desktop */}
            <div className="hidden lg:block flex-1" />

            {/* Controles del header (derecha) */}
            <div className="flex items-center gap-3">
              {/* Notificaciones */}
              <div className="relative">
                <NotificationsPanel />
              </div>

              {/* Menú móvil */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl hover:bg-slate-800/60 text-slate-300 transition-colors"
                aria-label="Abrir menú"
              >
                <Menu size={24} className="text-slate-300" />
              </button>
            </div>
          </header>

          {/* Contenido */}
          <div className="p-4 sm:p-6 lg:p-8 flex-1">
            <div className="max-w-7xl mx-auto w-full animate-fade-in">{children}</div>
          </div>
        </main>

        {/* Botón de instalación PWA */}
        <PWAInstallButton />

        {/* Botón flotante de soporte por WhatsApp */}
        {whatsappNumber && (
          <a
            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hola, necesito ayuda con StreamControl.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-5 right-5 z-50 group"
          >
            <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-900 border border-slate-800 text-slate-200 text-sm font-medium px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl backdrop-blur-sm">
              Chateá con soporte
            </span>
            <div className="flex items-center justify-center w-12 h-12 rounded-full shadow-lg shadow-emerald-950/40 transition-all duration-300 hover:scale-110 active:scale-95 bg-[#25D366] text-white hover:bg-[#20bd5a]">
              <MessageCircle size={22} />
            </div>
          </a>
        )}

        {/* Upgrade modal */}
        {mostrarUpgrade && (
          <UpgradeModal
            user={user}
            onClose={() => {
              try {
                sessionStorage.setItem('upgrade_modal_shown', 'true');
              } catch {
                // fail silently (private browsing, etc.)
              }
              setMostrarUpgrade(false);
            }}
          />
        )}
      </div>
    </UpgradeModalContext.Provider>
  );
}
