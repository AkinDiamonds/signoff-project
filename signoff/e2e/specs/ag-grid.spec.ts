import { expect, test } from '@playwright/test';

test.describe('AG Grid disputes workspace', () => {
  test('desktop grid renders rows, totals, side bar and opens a case', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'merchant-desktop');
    await page.goto('/app/disputes');
    await expect(page.getByTestId('disputes-grid')).toBeVisible();
    await expect(page.getByTestId('dispute-row-PP-D-1001')).toBeVisible();
    await expect(page.getByTestId('dispute-row-PP-D-1002')).toBeVisible();
    await expect(page.locator('.ag-status-bar')).toContainText('USD 149.50');
    await expect(page.locator('.ag-side-bar')).toBeVisible();
    await page.getByTestId('dispute-row-PP-D-1001').click();
    await expect(page).toHaveURL(/\/app\/disputes\/PP-D-1001$/);
    await page.goBack();
    await expect(page.getByTestId('disputes-grid')).toBeVisible();
  });

  test('dark mode keeps grid text readable', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'merchant-desktop');
    await page.addInitScript(() => localStorage.setItem('signoff-display', 'dark'));
    await page.goto('/app/disputes');
    const cell = page.locator('.ag-row[row-id="PP-D-1001"] [col-id="reason"]');
    await expect(cell).toBeVisible();
    const [text, background] = await cell.evaluate(element => [
      getComputedStyle(element).color,
      getComputedStyle(element.closest('.ag-root-wrapper') ?? element).backgroundColor,
    ]);
    expect(text).not.toBe(background);
    expect(text).not.toBe('rgb(23, 32, 27)');
  });

  test('mobile keeps cards by default and the Grid toggle persists without sideways page scroll', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'merchant-mobile');
    await page.goto('/app/disputes');
    await expect(page.getByTestId('disputes-table')).toBeVisible();
    await expect(page.locator('.ag-root-wrapper')).toHaveCount(0);
    await page.getByTestId('dispute-layout-toggle').getByRole('button', { name: 'Grid' }).click();
    await expect(page.getByTestId('disputes-grid')).toBeVisible();
    await expect(page.getByTestId('dispute-row-PP-D-1001')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.reload();
    await expect(page.getByTestId('disputes-grid')).toBeVisible();
    await page.getByTestId('dispute-layout-toggle').getByRole('button', { name: 'Cards' }).click();
    await expect(page.getByTestId('disputes-table')).toBeVisible();
  });

  test('AI assistant is one tap from More and answers a starter question', async ({ page }) => {
    await page.goto('/app/more');
    await page.getByRole('link', { name: /AI assistant/ }).click();
    const region = page.getByTestId('studio-region');
    await expect(region).toBeVisible();
    await region.getByText('Which disputes are due soon?').click();
    await expect(region).toContainText('open disputes');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
