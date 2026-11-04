import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: process.env['CI'] ? [['github'], ['html']] : [['list'], ['html']],
  timeout: 180_000, // ← global 3 minutes
  expect: { timeout: 30_000 },
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30_000, // ← per-action
    navigationTimeout: 60_000, // ← per-navigation
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Don't auto-start dashboard — user starts it manually to avoid startup race
  webServer: undefined,
});