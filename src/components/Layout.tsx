import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Menu, X, LayoutDashboard, DollarSign, BarChart3, Users, UserCog, LogOut, User, Download, MessageCircle } from 'lucide-react';
import PWAInstallButton from './PWAInstallButton';
import NotificationsPanel from './NotificationsPanel';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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

  const navItems: { to: string; icon: React.ComponentType<{ size?: number; className?: string }>; label: string }[] = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/ventas', icon: DollarSign, label: 'Ventas' },
    { to: '/reportes', icon: BarChart3, label: 'Reportes' },
    { to: '/GestionClientes', icon: Users, label: 'Clientes' },
  ];

  if (user?.rol === 'admin') {
    navItems.push({ to: '/usuarios', icon: UserCog, label: 'Usuarios' });
  }

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen font-inter bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      {/* Overlay para móvil */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 p-6
          backdrop-blur-xl bg-gradient-to-b from-indigo-600/95 via-purple-600/90 to-cyan-600/95
          text-white shadow-2xl
          flex flex-col justify-between
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header del sidebar */}
        <div>
          <div className="flex items-center justify-between mb-8">
            <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-white tracking-wide">
              StreamControl <span className="font-extrabold">Pro</span>
            </div>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-white hover:text-cyan-200 transition-colors"
                aria-label="Cerrar menú"
              >
                <X size={24} />
              </button>
            )}
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
                      ? 'bg-white/20 shadow-lg scale-105'
                      : 'hover:bg-white/10 hover:translate-x-1'
                    }
                  `}
                >
                  <Icon size={20} className={active ? 'text-cyan-200' : ''} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
            
            {/* Botón de instalación PWA en sidebar */}
            <div className="mt-2 pt-2 border-t border-white/20">
              <PWAInstallButton showInSidebar={true} />
            </div>

            {/* Configuración */}
            <div className="mt-2 pt-2 border-t border-white/20">
              <Link
                to="/telegram"
                onClick={() => isMobile && setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive('/telegram')
                    ? 'bg-white/20 shadow-lg scale-105'
                    : 'hover:bg-white/10 hover:translate-x-1'
                }`}
              >
                <MessageCircle size={20} className={isActive('/telegram') ? 'text-cyan-200' : ''} />
                <span className="font-medium">Telegram</span>
              </Link>
            </div>
          </nav>
        </div>

        {/* Información del usuario */}
        <div className="mt-8 border-t border-white/30 pt-4 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <User size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs opacity-80 truncate">Conectado como</div>
              <div className="text-sm font-semibold truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 bg-white/20 text-white px-4 py-2.5 rounded-xl hover:bg-white/30 transition-all font-medium"
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 lg:ml-0 min-h-screen">
        {/* Header superior */}
        <header className="sticky top-0 z-30 glass-strong border-b border-white/40 px-4 sm:px-6 lg:px-8 py-3 lg:py-4 flex items-center justify-between">
          {/* Logo/Título - Solo móvil */}
          <div className="lg:hidden text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
            StreamControl Pro
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
              className="lg:hidden p-2 rounded-lg hover:bg-white/20 transition-colors"
              aria-label="Abrir menú"
            >
              <Menu size={24} className="text-gray-700" />
            </button>
          </div>
        </header>

        {/* Contenido */}
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full animate-fade-in">{children}</div>
        </div>
      </main>

      {/* Botón de instalación PWA */}
      <PWAInstallButton />
    </div>
  );
}
