import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallButtonProps {
  showInSidebar?: boolean;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

export default function PWAInstallButton({ showInSidebar = false }: PWAInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const hasSeenBanner = localStorage.getItem('pwa-banner-seen');
      if (!hasSeenBanner) {
        setTimeout(() => setShowBanner(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
      localStorage.setItem('pwa-installed', 'true');
      toast.success('¡Aplicación instalada exitosamente!');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast.error('La instalación no está disponible en este momento');
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        toast.success('Instalación iniciada...');
      } else {
        toast('Instalación cancelada');
      }

      setDeferredPrompt(null);
      setShowBanner(false);
      localStorage.setItem('pwa-banner-seen', 'true');
    } catch (error) {
      console.error('Error al instalar:', error);
      toast.error('Error al instalar la aplicación');
    }
  };

  const handleDismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-banner-seen', 'true');
  };

  if (showInSidebar && (!deferredPrompt || isInstalled)) {
    return null;
  }

  if (!showInSidebar && (isInstalled || (!deferredPrompt && !showBanner))) {
    return null;
  }

  if (showInSidebar && deferredPrompt) {
    return (
      <button
        onClick={handleInstallClick}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/70 hover:bg-indigo-600/20 hover:border-indigo-500/30 border border-slate-700/60 text-slate-200 hover:text-cyan-300 transition-all font-medium"
        aria-label="Instalar aplicación"
      >
        <Download size={20} />
        <span>Instalar App</span>
      </button>
    );
  }

  return (
    <>
      {deferredPrompt && !showBanner && (
        <button
          onClick={handleInstallClick}
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-3 rounded-full shadow-2xl shadow-indigo-950/60 flex items-center gap-2 font-semibold hover:scale-105 transition-all duration-300 animate-scale-in"
          aria-label="Instalar aplicación"
        >
          <Download size={20} />
          <span className="hidden sm:inline">Instalar App</span>
        </button>
      )}

      {showBanner && deferredPrompt && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md mx-4 animate-scale-in">
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl text-slate-100">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-950/50">
                  <Download className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">Instala StreamControl Pro</h3>
                  <p className="text-sm text-slate-400">Acceso rápido desde tu pantalla de inicio</p>
                </div>
              </div>
              <button
                onClick={handleDismissBanner}
                className="text-slate-400 hover:text-slate-200 transition-colors"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleInstallClick}
                className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Instalar ahora
              </button>
              <button
                onClick={handleDismissBanner}
                className="px-4 py-2.5 rounded-xl font-medium text-slate-400 hover:text-slate-200 bg-slate-850 hover:bg-slate-800 border border-slate-800 transition-colors"
              >
                Más tarde
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
