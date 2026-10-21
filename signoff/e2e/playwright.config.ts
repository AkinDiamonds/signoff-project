import { defineConfig, devices } from '@playwright/test';

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:5173';
const SHOP_URL = process.env.SHOP_URL ?? 'http://localhost:5174';

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
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
    {
      name: 'merchant-mobile',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'shop-desktop',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: SHOP_URL,
      },
    },
  ],
  webServer: [
    {
      command: 'npm run -w @signoff/web dev -- --port 5173 --strictPort',
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      env: { VITE_MOCK_API: 'true' },
    },
    {
      command: 'npm run -w @signoff/shop dev -- --port 5174 --strictPort',
      url: SHOP_URL,
      reuseExistingServer: !process.env.CI,
      env: { VITE_MOCK_API: 'true' },
    },
  ],
});
