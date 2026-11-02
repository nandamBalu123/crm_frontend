import { defineConfig } from '@playwright/test';

/**
 * Browser E2E against the real API + SPA. Start the API first
 * (`cd backend && npm run dev:ephemeral` with LOG_LEVEL=info and MAIL_TRANSPORT=log)
 * and point E2E_API_LOG at its log file so tests can read development email links.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: 'npx vite --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 },
});
