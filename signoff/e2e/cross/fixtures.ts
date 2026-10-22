import { test as base, type Page } from '@playwright/test';
import { newSession } from './helpers/agent';

export const SESSION_KEY = 'signoff.demo.session';

export interface DemoSession {
  id: string;
  applyTo(page: Page): Promise<void>;
}

export const test = base.extend<{ session: DemoSession }>({
  session: async ({ request }, use) => {
    const id = await newSession(request);
    await use({
      id,
      async applyTo(page: Page): Promise<void> {
        await page.addInitScript((sid: string) => {
          window.sessionStorage.setItem('signoff.demo.session', sid);
        }, id);
      },
    });
  },
});

export { expect } from '@playwright/test';
