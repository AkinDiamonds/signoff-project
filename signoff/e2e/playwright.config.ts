import { defineConfig, devices } from '@playwright/test';

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    locale: 'en-US',
    timezoneId: 'UTC',
  },
  projects: [
    {
      name: 'merchant-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run -w @signoff/web dev -- --port 5173 --strictPort',
    url: WEB_URL,
    reuseExistingServer: !process.env.CI,
    env: { VITE_MOCK_API: 'true' },
  },
});
