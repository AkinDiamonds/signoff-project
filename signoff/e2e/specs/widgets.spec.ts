import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Custom widgets (Step 29)', () => {
  test('renders all three widgets with text labels and focusable rows', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByTestId('widget-decision-timeline')).toBeVisible();
    await expect(page.getByTestId('widget-deadline-radar')).toBeVisible();
    await expect(page.getByTestId('widget-authority-meter')).toBeVisible();

    await expect(page.getByTestId('deadline-radar-row-PP-D-1001')).toContainText('Scheduled');
    await expect(page.getByTestId('authority-meter-values-auto_act_max_dispute_amount')).toContainText(
      '$107.50 of $100.00'
    );
    await expect(page.getByTestId('authority-meter-over-limit-auto_act_max_dispute_amount')).toContainText(
      'Over limit'
    );

    await page.getByTestId('deadline-radar-row-PP-D-1001').focus();
    await expect(page.getByTestId('deadline-radar-row-PP-D-1001')).toBeFocused();
  });

  test('stays usable at a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/app');
    await expect(page.getByTestId('deadline-radar')).toBeVisible();
    await expect(page.getByTestId('authority-meter')).toBeVisible();
  });

  test('deadline radar matches the approved screenshot within tolerance', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByTestId('deadline-radar')).toBeVisible();
    await expect(page.getByTestId('widget-deadline-radar')).toHaveScreenshot('deadline-radar.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('dashboard widgets have no serious accessibility violations', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByTestId('authority-meter')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical'
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
