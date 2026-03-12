// Service Worker para StreamControl Pro
const CACHE_NAME = 'streamcontrol-v2';
const STATIC_CACHE = 'streamcontrol-static-v2';
const DYNAMIC_CACHE = 'streamcontrol-dynamic-v2';

// Assets estáticos a cachear
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/App.jsx',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Cacheando assets estáticos');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE;
          })
          .map((cacheName) => {
            console.log('[SW] Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
  return self.clients.claim();
});

// Estrategia de cache: Network First con fallback a cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar esquemas no soportados (chrome-extension, etc.)
  if (
    url.protocol === 'chrome-extension:' ||
    url.protocol === 'moz-extension:' ||
    url.protocol === 'safari-extension:' ||
    !url.protocol.startsWith('http')
  ) {
    return; // No procesar estos requests
  }

  // No cachear requests a Firebase (siempre usar red)
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('google.com')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Solo cachear requests GET válidos
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // Para otros recursos, usar estrategia Network First
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Solo cachear respuestas válidas
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Clonar la respuesta antes de cachearla
        const responseClone = response.clone();

        // Verificar que la respuesta sea cacheable
        try {
          caches.open(DYNAMIC_CACHE).then((cache) => {
            try {
              cache.put(request, responseClone);
            } catch (err) {
              console.warn('[SW] Error al cachear:', err);
            }
          });
        } catch (err) {
          console.warn('[SW] Error al abrir cache:', err);
        }

        return response;
      })
      .catch(() => {
        // Si falla la red, buscar en cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si no hay cache y es una navegación, devolver index.html
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

