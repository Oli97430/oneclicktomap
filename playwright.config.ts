import { defineConfig } from '@playwright/test';

// Tests E2E Electron. Lancer un build au préalable : `npm run build`.
export default defineConfig({
  testDir: './tests-e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
});
