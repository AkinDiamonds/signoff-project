import { defineConfig, devices } from '@playwright/test';

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:5173';
const SHOP_URL = process.env.SHOP_URL ?? 'http://localhost:5174';
const FROZEN_WEB_URL = process.env.FROZEN_WEB_URL ?? 'http://localhost:5175';
const AGENT_URL = process.env.VITE_API_URL ?? 'http://localhost:8000';
const FROZEN_AGENT_URL = process.env.FROZEN_AGENT_URL ?? 'http://localhost:8001';

export default defineConfig({
  testDir: './cross',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  globalSetup: './cross/global-setup.ts',
  reporter: process.env.CI ? [['list'], ['html']] : [['list']],
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-US',
    timezoneId: 'UTC',
    actionTimeout: 15000,
  },
  expect: {
    timeout: 15000,
  },
  projects: [
    {
      name: 'merchant-desktop',
      testIgnore: ['**/c-*.spec.ts', '**/security*.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: WEB_URL,
      },
    },
    {
      name: 'merchant-mobile',
      testMatch: '**/c-*.spec.ts',
      use: {
        ...devices['Pixel 5'],
        baseURL: WEB_URL,
      },
    },
    {
      name: 'shop-desktop',
      testMatch: '**/security*.spec.ts',
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
      env: { VITE_API_URL: AGENT_URL },
    },
    {
      command: 'npm run -w @signoff/shop dev -- --port 5174 --strictPort',
      url: SHOP_URL,
      reuseExistingServer: !process.env.CI,
      env: { VITE_API_URL: AGENT_URL },
    },
    {
      command: 'npm run -w @signoff/web dev -- --port 5175 --strictPort',
      url: FROZEN_WEB_URL,
      reuseExistingServer: !process.env.CI,
      env: { VITE_API_URL: FROZEN_AGENT_URL },
    },
  ],
});
