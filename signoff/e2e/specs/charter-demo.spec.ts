import { expect, test } from '@playwright/test';

test.describe('Charter and demo panel (Step 27)', () => {
  test('lower a limit and save a new charter version', async ({ page }) => {
    await page.goto('/app/charter');
    await expect(page.getByTestId('charter-title')).toBeVisible();

    await page.getByLabel('Auto-offer maximum (USD)').fill('10');
    await page.getByTestId('charter-save-button').click();

    await expect(page.getByTestId('charter-save-success')).toContainText('v2');
    await expect(page.getByTestId('charter-history-item-2')).toBeVisible();
  });

  test('run scenario C and see the approval requirement', async ({ page }) => {
    await page.goto('/app/demo');
    await expect(page.getByTestId('demo-panel-title')).toBeVisible();

    await page.getByTestId('demo-scenario-C').click();
    await expect(page.getByTestId('demo-created-link')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('demo-created-link').click();

    await expect(page).toHaveURL(/\/app\/disputes\/PP-DEMO-C-/);
    await expect(page.getByTestId('detail-verdict-chip')).toContainText('Needs Approval');
  });

  test('shows the quota message when creation is rate limited', async ({ page }) => {
    await page.goto('/app/demo?mock-quota=true');
    await page.getByTestId('demo-scenario-B').click();
    await expect(page.getByTestId('demo-error')).toContainText('Daily demo quota reached');
    await expect(page.getByTestId('demo-error')).toContainText('Resets at');
  });
});
