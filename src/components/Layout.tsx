import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  LayoutDashboard,
  DollarSign,
  BarChart3,
  Users,
  UserPlus,
  LogOut,
  User,
  MessageCircle,
  Package,
  Send,
  Settings,
  CreditCard,
  Key,
} from 'lucide-react';
import TopBar from './TopBar';
import PWAInstallButton from './PWAInstallButton';
import UpgradeModal from './UpgradeModal';
import UpgradeModalContext from '../contexts/UpgradeModalContext';
import usePermisos from '../hooks/usePermisos';
import { useAdminConfig, sanitizarWhatsApp } from '../hooks/useAdminConfig';
import BroadcastBanner from './BroadcastBanner';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const permisos = usePermisos(user);
  const { config } = useAdminConfig();
  const whatsappNumber = config.whatsapp ? sanitizarWhatsApp(config.whatsapp) : '';
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  // Close mobile drawer on desktop resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navItems: { to: string; icon: React.ComponentType<{ size?: number; className?: string }>; label: string }[] =
    user?.rol === 'admin'
      ? [
          { to: '/', icon: LayoutDashboard, label: 'Panel Ejecutivo' },
          { to: '/usuarios', icon: Users, label: 'Directorio & CRM Usuarios' },
          { to: '/admin/suscripciones', icon: CreditCard, label: 'Suscripciones & Cobranzas' },
          { to: '/admin/planes', icon: Package, label: 'Planes & Cuotas' },
          { to: '/telegram', icon: Send, label: 'Telegram' },
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
      <div className="flex flex-col lg:flex-row min-h-screen font-inter bg-slate-950 text-slate-100 relative overflow-x-hidden">
        {/* Ambient Radial Lights */}
        <div className="w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none absolute -top-40 -left-40 z-0" />
        <div className="w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none absolute -bottom-40 -right-40 z-0" />

        {/* ========================================================================= */}
        {/* DESKTOP SIDEBAR (Fixed Height, Sticky, >= lg) */}
        {/* ========================================================================= */}
        <aside className="hidden lg:flex lg:flex-col w-64 h-screen sticky top-0 bg-slate-900/90 backdrop-blur-xl border-r border-slate-800/80 text-slate-200 z-40 shrink-0 select-none">
          {/* Header with Logo & Title */}
          <div className="p-5 border-b border-slate-800/60 shrink-0">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center p-1.5 shadow-inner transition-transform group-hover:scale-105">
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
              <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300 tracking-wide">
                StreamControl <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Pro</span>
              </div>
            </Link>
          </div>

          {/* Middle Navigation */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5 scrollbar-thin">
            <nav className="flex flex-col gap-1.5" aria-label="Navegación principal">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      active
                        ? 'bg-indigo-600/20 text-cyan-300 border border-indigo-500/30 shadow-md shadow-indigo-950/40'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 hover:translate-x-0.5'
                    }`}
                  >
                    <Icon size={18} className={active ? 'text-cyan-300' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {/* PWA Install Button */}
              <div className="mt-2 pt-2 border-t border-slate-800/80">
                <PWAInstallButton showInSidebar={true} />
              </div>

              {/* Telegram Link (non-admin) */}
              {user?.rol !== 'admin' && (
                <div className="mt-2 pt-2 border-t border-slate-800/80">
                  <Link
                    to="/telegram"
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive('/telegram')
                        ? 'bg-indigo-600/20 text-cyan-300 border border-indigo-500/30 shadow-md shadow-indigo-950/40'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 hover:translate-x-0.5'
                    }`}
                  >
                    <MessageCircle size={18} className={isActive('/telegram') ? 'text-cyan-300' : 'text-slate-400'} />
                    <span>Telegram</span>
                  </Link>
                </div>
              )}
            </nav>
          </div>

          {/* Bottom User Card */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 shrink-0 mt-auto space-y-3">
            <div className="flex items-center gap-3 px-1">
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700/60 text-slate-300 flex items-center justify-center shrink-0">
                <User size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 truncate">Conectado como</span>
                  {permisos.planNombre && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                      {permisos.planNombre}
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold text-slate-200 truncate">{user?.email}</div>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 bg-slate-800/60 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-800/40 border border-slate-700/50 text-slate-300 px-4 py-2.5 rounded-xl transition-all font-medium text-xs shadow-sm cursor-pointer"
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* MOBILE OFF-CANVAS DRAWER (< lg) */}
        {/* ========================================================================= */}
        {/* Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 lg:hidden transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Drawer Panel */}
        <aside
          className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] h-full bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 text-slate-200 z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-label="Menú móvil"
        >
          {/* Close button */}
          <div className="flex justify-end p-3 shrink-0">
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Cerrar menú"
            >
              <X size={20} />
            </button>
          </div>

          {/* Drawer Navigation */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5 overscroll-contain">
            <nav className="flex flex-col gap-1.5" aria-label="Navegación móvil">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      active
                        ? 'bg-indigo-600/20 text-cyan-300 border border-indigo-500/30 shadow-md shadow-indigo-950/40'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon size={18} className={active ? 'text-cyan-300' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {/* PWA Button */}
              <div className="mt-2 pt-2 border-t border-slate-800/80">
                <PWAInstallButton showInSidebar={true} />
              </div>

              {/* Telegram Link */}
              {user?.rol !== 'admin' && (
                <div className="mt-2 pt-2 border-t border-slate-800/80">
                  <Link
                    to="/telegram"
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive('/telegram')
                        ? 'bg-indigo-600/20 text-cyan-300 border border-indigo-500/30 shadow-md shadow-indigo-950/40'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                    }`}
                  >
                    <MessageCircle size={18} className={isActive('/telegram') ? 'text-cyan-300' : 'text-slate-400'} />
                    <span>Telegram</span>
                  </Link>
                </div>
              )}
            </nav>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/90 shrink-0 mt-auto space-y-3">
            <div className="flex items-center gap-3 px-1">
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700/60 text-slate-300 flex items-center justify-center shrink-0">
                <User size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 truncate">Conectado como</span>
                  {permisos.planNombre && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                      {permisos.planNombre}
                    </span>
                  )}
                </div>
                <div className="text-xs font-semibold text-slate-200 truncate">{user?.email}</div>
              </div>
            </div>
            <button
              onClick={() => {
                setSidebarOpen(false);
                logout();
              }}
              className="w-full flex items-center justify-center gap-2 bg-slate-800/60 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-800/40 border border-slate-700/50 text-slate-300 px-3.5 py-2 rounded-xl transition-all font-medium text-xs cursor-pointer"
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* MAIN CONTENT WRAPPER */}
        {/* ========================================================================= */}
        <div className="flex-1 min-w-0 min-h-screen flex flex-col bg-slate-950 text-slate-100">
          <BroadcastBanner />

          {/* TopBar unificado (mobile: logo+notif+hamburger | desktop: notif only) */}
          <TopBar onMenuToggle={() => setSidebarOpen(true)} />

          {/* Main Content Area */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            <div className="animate-fade-in">{children}</div>
          </main>
        </div>

        {/* Floating PWA Install Button */}
        <PWAInstallButton />

        {/* Floating WhatsApp Support Button */}
        {whatsappNumber && (
          <a
            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hola, necesito ayuda con StreamControl.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-5 right-5 z-40 group"
          >
            <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-900 border border-slate-800 text-slate-200 text-sm font-medium px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl backdrop-blur-sm">
              Chateá con soporte
            </span>
            <div className="flex items-center justify-center w-12 h-12 rounded-full shadow-lg shadow-emerald-950/40 transition-all duration-300 hover:scale-110 active:scale-95 bg-[#25D366] text-white hover:bg-[#20bd5a]">
              <MessageCircle size={22} />
            </div>
          </a>
        )}

        {/* Upgrade Modal */}
        {mostrarUpgrade && (
          <UpgradeModal
            user={user}
            onClose={() => {
              try {
                sessionStorage.setItem('upgrade_modal_shown', 'true');
              } catch {
                // fail silently
              }
              setMostrarUpgrade(false);
            }}
          />
        )}
      </div>
    </UpgradeModalContext.Provider>
  );
}
