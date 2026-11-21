import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Portal de matemáticas',
        short_name: 'Matemáticas',
        lang: 'es',
        description: 'Repaso de matemáticas para estudiantes',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#1e40af',
        background_color: '#ffffff',
        icons: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { proxy: { '/api': 'http://localhost:8081' } },
});
