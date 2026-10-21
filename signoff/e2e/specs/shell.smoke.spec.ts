import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('@smoke web shell', () => {
  test('boots and shows the status panel', { tag: '@smoke' }, async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'System status' })).toBeVisible();
    await expect(page.getByTestId('status-llm-mode')).toHaveText('CACHED');
  });

  test('unknown route shows the not-found page', { tag: '@smoke' }, async ({ page }) => {
    await page.goto('/no-such-page');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });

  test('skip link moves focus to the main landmark', { tag: '@smoke' }, async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main-content$/);
    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('shell has no serious accessibility violations', { tag: '@smoke' }, async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('status-llm-mode')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
