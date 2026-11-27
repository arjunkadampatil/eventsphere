import { defineConfig } from '@playwright/test';

// Runs against the production build (vite preview). Set E2E_BASE_URL to test an
// already-running or deployed site instead of starting the API and preview here.
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: external ?? 'http://localhost:4173',
    // System Chrome, not Playwright's pinned Chromium: production bugs can depend on
    // behaviour that only ships in current browsers.
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: external
    ? undefined
    : [
        { command: 'node src/index.js', cwd: '../server', url: 'http://localhost:4000/api/health', timeout: 120_000 },
        { command: 'npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', timeout: 60_000 },
      ],
});
