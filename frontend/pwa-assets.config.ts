import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Regenerar iconos: pnpm generate-pwa-assets
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#80C9EE' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#80C9EE' } },
  },
  images: ['public/logo.svg'],
});
