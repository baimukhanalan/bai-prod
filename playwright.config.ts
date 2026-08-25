import { defineConfig, devices } from '@playwright/test';

const channel = process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'darwin' ? 'chrome' : undefined);
const webPort = Number(process.env.E2E_WEB_PORT ?? 5173);
const webUrl = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: 'web.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL: webUrl,
    ...(channel ? { channel } : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium' } },
    { name: 'mobile-chromium', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  webServer: {
    command: `npm run dev -w @bai/web -- --port ${webPort} --strictPort`,
    url: webUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
