import { expect, test } from '@playwright/test';

test.describe('AG Studio dashboard and assistant (Step 28)', () => {
  test('loads KPI numbers that match the API and lists disputes', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByTestId('dashboard-title')).toBeVisible();

    await expect(page.getByTestId('kpi-open-disputes')).toHaveText('2');
    await expect(page.getByTestId('kpi-dollars-at-risk')).toHaveText('USD 149.50');
    await expect(page.getByTestId('kpi-assumption')).toContainText('20 minutes');
    await expect(page.getByTestId('dashboard-dispute-row-PP-D-1001')).toBeVisible();
    await expect(page.getByTestId('dashboard-dispute-row-PP-D-1002')).toBeVisible();
  });

  test('answers a canned assistant question through the fake LLM', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByTestId('assistant-panel')).toBeVisible();

    await page.getByTestId('assistant-sample-0').click();
    await expect(page.getByTestId('assistant-answer')).toContainText('2 open disputes');
    await expect(page.getByTestId('assistant-answer')).toContainText('USD 149.50 at risk');
  });

  test('loads the AG Studio workspace without falling back', async ({ page }) => {
    await page.goto('/app');
    await page.getByTestId('studio-load-button').click();
    await expect(page.getByTestId('studio-region')).toBeVisible();
    await page.waitForTimeout(2000);
    await expect(page.getByTestId('studio-fallback')).toHaveCount(0);
  });

  test('keeps a plain dispute-list path available when Studio is not loaded', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByTestId('studio-load-button')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Or use the plain dispute list' })).toHaveAttribute(
      'href',
      '/app/disputes'
    );
  });
});
