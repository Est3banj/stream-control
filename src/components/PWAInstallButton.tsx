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
      toast.success('¡Aplicación instalada exitosamente! 🎉');
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
        toast('Instalación cancelada', { icon: 'ℹ️' });
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
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/20 text-white hover:bg-white/30 transition-all font-medium"
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
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-semibold hover:scale-110 transition-all duration-300 animate-scale-in"
          aria-label="Instalar aplicación"
        >
          <Download size={20} />
          <span className="hidden sm:inline">Instalar App</span>
        </button>
      )}

      {showBanner && deferredPrompt && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md mx-4 animate-scale-in">
          <div className="glass-strong rounded-2xl p-6 shadow-2xl border border-white/40">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                  <Download className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Instala StreamControl Pro</h3>
                  <p className="text-sm text-gray-600">Acceso rápido desde tu pantalla de inicio</p>
                </div>
              </div>
              <button
                onClick={handleDismissBanner}
                className="text-gray-400 hover:text-gray-600 transition-colors"
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
                className="px-4 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-colors"
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
