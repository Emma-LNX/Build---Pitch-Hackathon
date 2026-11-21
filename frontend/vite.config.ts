import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { loadPublicAuth, publicAuthIssues } from './config/public-auth';

export default defineConfig(({ mode }) => {
  const auth = loadPublicAuth(mode);
  if (auth.key && publicAuthIssues(auth).some((issue) => issue.includes('clave'))) {
    throw new Error('La configuración del frontend requiere una clave publishable o anon válida.');
  }
  return {
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(auth.url),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(auth.key),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(auth.key),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      manifest: {
        name: 'MayaMente',
        short_name: 'MayaMente',
        lang: 'es',
        description: 'Aventura de matemática para 4.º a 6.º primaria, también sin internet',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#278FC7',
        background_color: '#80C9EE',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { proxy: { '/api': 'http://localhost:8081' } },
  };
});
