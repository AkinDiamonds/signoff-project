import { expect, test } from '@playwright/test';

test('save controls and mobile navigation remain separate', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'merchant-mobile');
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto('/app/policy');
    await expect(page.getByTestId('charter-title')).toBeVisible();
    await page.getByLabel('Auto-offer maximum (USD)').fill('30');
    const save = page.getByTestId('charter-save-button');
    await save.scrollIntoViewIfNeeded();
    const bar = await page.getByTestId('charter-sticky-save-bar').boundingBox();
    const nav = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
    expect(bar).not.toBeNull();
    expect(nav).not.toBeNull();
    if (bar && nav) expect(bar.y + bar.height).toBeLessThanOrEqual(nav.y);
    await expect(save).toBeEnabled();
  }
});
