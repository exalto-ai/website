import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const localBrowser = process.env.PLAYWRIGHT_EXECUTABLE_PATH;

export default defineConfig({
  optimizeDeps: { include: ['openapi-fetch', 'react-dom/client', 'react-markdown'] },
  resolve: { alias: { '@': resolve(process.cwd(), 'src/tools') } },
  plugins: [react()],
  test: {
    include: ['src/tools/PublicTools.browser.test.jsx'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(
        localBrowser ? { launchOptions: { executablePath: localBrowser } } : undefined,
      ),
      instances: [{ browser: 'chromium' }],
      viewport: { width: 1280, height: 900 },
    },
  },
});
