import React from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
      <Toaster position="top-right" />
    </AuthProvider>
  </React.StrictMode>
)

// Limpiar solo service workers y caches de StreamControl
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) {
      // Solo tocar SW que pertenezcan a esta app
      if (reg.scope.includes(location.pathname) || reg.active?.scriptURL?.includes('sw.js')) {
        reg.unregister();
        console.log('SW de StreamControl desregistrado');
      }
    }
    if (window.caches) {
      caches.keys().then((keys) => {
        keys
          .filter((k) => k.startsWith('streamcontrol-'))
          .forEach((k) => caches.delete(k));
      });
    }
  }).catch(() => {});
}
