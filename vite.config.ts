/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
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
        start_url: '/',
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
  build: {
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
  },
})
