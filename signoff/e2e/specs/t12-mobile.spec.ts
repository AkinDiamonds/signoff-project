import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('merchant and shop pages fit narrow screens', async ({ page }) => {
  test.setTimeout(120000);
  const merchant = ['/', '/guide', '/app', '/app/disputes', '/app/disputes/PP-D-1001', '/app/policy', '/app/settings', '/app/notifications', '/approve/sample-token-12345678901234567890'];
  const shop = ['/', '/cart', '/checkout', '/orders'];
  const failures: string[] = [];
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 });
    for (const [base, paths] of [['http://localhost:5173', merchant], ['http://localhost:5174', shop]] as const) {
      for (const path of paths) {
        await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
        const overflow = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        if (overflow.scroll > overflow.width + 1) failures.push(`${width} ${base}${path}: ${overflow.scroll}`);
      }
    }
  }
  expect(failures).toEqual([]);
});

test('dispute detail has no serious accessibility violations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/app/disputes/PP-D-1001');
  await expect(page.getByTestId('dispute-status-summary')).toBeVisible();
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

test('key merchant flows have no serious accessibility violations', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 800 });
  const failures: string[] = [];
  for (const path of ['/', '/guide', '/app', '/app/disputes', '/app/policy', '/app/settings', '/app/notifications', '/approve/sample-token-12345678901234567890']) {
    await page.goto(path, { waitUntil: 'networkidle' });
    const result = await new AxeBuilder({ page }).analyze();
    for (const violation of result.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')) {
      failures.push(`${path}: ${violation.id}: ${violation.nodes.map(n => n.target.join(' ')).join(', ')}`);
    }
  }
  expect(failures).toEqual([]);
});

test('phone buyer can reach checkout and order lookup', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const product = { sku: 'CND-LAV-01', name: 'Lavender Candle', description: 'Fictional candle', price: { currency_code: 'USD', value: '21.00' } };
  await page.route('**/api/shop/catalog**', route => route.fulfill({ json: route.request().url().includes('CND-LAV-01') ? product : [product], headers: { 'access-control-allow-origin': '*' } }));
  await page.goto('http://localhost:5174/');
  await page.getByTestId('shop-view-product-CND-LAV-01').click();
  await page.getByTestId('shop-add-to-cart-btn').click();
  await page.getByTestId('shop-cart-button').click();
  await page.getByTestId('shop-checkout-btn').click();
  await expect(page.getByTestId('shop-email-input')).toBeVisible();
  await page.getByTestId('shop-back-to-cart-link').click();
  await expect(page.getByTestId('shop-cart-row-CND-LAV-01')).toBeVisible();
  await page.goto('http://localhost:5174/orders');
  await page.getByTestId('portal-order-code-input').fill('SIG-A-1001');
  await page.getByTestId('portal-email-input').fill('alex.morgan@example.test');
  await expect(page.getByTestId('portal-lookup-submit-btn')).toBeEnabled();
});

test('dispute deep link survives refresh and browser back', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/app/disputes');
  await page.getByTestId('dispute-link-PP-D-1001').click();
  await expect(page.getByTestId('dispute-status-summary')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('dispute-status-summary')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/disputes$/);
  await expect(page.getByTestId('dispute-link-PP-D-1001')).toBeVisible();
});

test('dispute list presents readable cards on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/app/disputes');
  const row = page.getByTestId('dispute-row-PP-D-1001');
  await expect(row).toBeVisible();
  await expect(row).toHaveCSS('display', 'block');
  await expect(row.getByText('Waiting for your response')).toBeVisible();
  expect(await row.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

test('buyer pages have no serious accessibility violations', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 800 });
  const product = { sku: 'CND-LAV-01', name: 'Lavender Candle', description: 'Fictional candle', price: { currency_code: 'USD', value: '21.00' } };
  await page.route('**/api/shop/catalog**', route => route.fulfill({ json: route.request().url().includes('CND-LAV-01') ? product : [product], headers: { 'access-control-allow-origin': '*' } }));
  const failures: string[] = [];
  for (const path of ['/', '/cart', '/checkout', '/orders']) {
    await page.goto(`http://localhost:5174${path}`, { waitUntil: 'networkidle' });
    const result = await new AxeBuilder({ page }).analyze();
    for (const violation of result.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')) {
      failures.push(`${path}: ${violation.id}: ${violation.nodes.map(n => n.target.join(' ')).join(', ')}`);
    }
  }
  expect(failures).toEqual([]);
});
