import { expect, test } from '@playwright/test';

test.describe('Buyer PayPal Resolution Center handoff', () => {
  test.use({ baseURL: process.env.SHOP_URL ?? 'http://localhost:5174' });

  for (const path of ['/orders/SIG-A-1001/dispute/new', '/orders/SIG-A-1001/dispute']) {
    test(`${path} sends buyers to PayPal without an app-hosted dispute form`, async ({ page }) => {
      const writes: string[] = [];
      page.on('request', request => {
        if (request.method() === 'POST') writes.push(request.url());
      });
      await page.goto(path);
      const link = page.getByTestId('paypal-resolution-link');
      await expect(link).toHaveAttribute('href', 'https://www.sandbox.paypal.com/disputes/');
      await expect(page.getByTestId('paypal-resolution-guidance')).toContainText('Disputes are filed on PayPal');
      await expect(page.getByRole('textbox')).toHaveCount(0);
      expect(writes).toEqual([]);
    });
  }
});
