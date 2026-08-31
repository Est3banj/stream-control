/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/** Rewrite /r/** → /app/index.html (mirrors Firebase Hosting rewrite for local dev) */
function rRewrite() {
  return {
    name: 'r-rewrite',
    configureServer(server: any) {
      server.middlewares.use((req: any, _res: any, next: any) => {
        if (req.url?.startsWith('/r/')) {
          req.url = '/app/index.html';
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: '/app/',
  plugins: [
    rRewrite(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['stream.webp'],
      manifest: {
        name: 'StreamControl Pro',
        short_name: 'StreamControl',
        description: 'Gestión de servicios de streaming',
        theme_color: '#4F46E5',
        background_color: '#EEF2FF',
        display: 'standalone',
        start_url: '/app/',
        icons: [
          {
            src: 'stream.webp',
            sizes: '192x192',
            type: 'image/webp',
          },
          {
            src: 'stream.webp',
            sizes: '512x512',
            type: 'image/webp',
          },
          {
            src: 'stream.webp',
            sizes: '1200x1200',
            type: 'image/webp',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,webp,ico,svg}'],
        // Forzar activación inmediata del nuevo SW
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/(?:firestore|firebase|googleapis|gstatic)\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  publicDir: 'public',
  server: {
    proxy: {
      // Dev: redirige /api/* → Express local (api: npm run dev)
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/app',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
    exclude: ['api/**', '**/node_modules/**', 'dist/**', 'functions/**'],
  },
})
