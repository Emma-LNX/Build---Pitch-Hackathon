import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  use: {
    baseURL: process.env.APP_URL ?? 'http://127.0.0.1:5173',
    browserName: 'chromium',
    channel: process.env.CI ? undefined : 'chrome',
    headless: true,
  },
});
