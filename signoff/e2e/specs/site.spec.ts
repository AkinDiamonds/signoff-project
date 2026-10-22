import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Product site and judge guide', () => {
  test('landing renders hero, claims, and call to action reaches guide', async ({ page }) => {
    await page.goto('/');

    // Hero and headings
    await expect(page.getByRole('heading', { level: 1, name: /AI-Driven Dispute Defense/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /The Problem:/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /The Solution: The Authority Charter/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /How It Works:/i })).toBeVisible();

    // System status card preserved
    await expect(page.getByTestId('home-status-card')).toBeVisible();

    // Verified claims ledger
    await expect(page.getByTestId('claim-card-CLAIM-AI-NO-MUTATING')).toBeVisible();

    // Call to action navigates to /guide
    const guideCta = page.getByTestId('landing-cta-guide');
    await expect(guideCta).toBeVisible();
    await guideCta.click();

    await expect(page).toHaveURL(/\/guide$/);
    await expect(page.getByRole('heading', { level: 1, name: /5-Minute Judge Guide/i })).toBeVisible();
  });

  test('guide renders numbered steps, test credentials, and architecture comparison', async ({ page }) => {
    await page.goto('/guide');

    // 5-step numbered path
    await expect(page.getByTestId('guide-step-1')).toBeVisible();
    await expect(page.getByTestId('guide-step-2')).toBeVisible();
    await expect(page.getByTestId('guide-step-3')).toBeVisible();
    await expect(page.getByTestId('guide-step-4')).toBeVisible();
    await expect(page.getByTestId('guide-step-5')).toBeVisible();

    // Credentials
    await expect(page.getByTestId('guide-credentials-card')).toBeVisible();
    await expect(page.getByTestId('guide-buyer-email')).toHaveText('alex.morgan@example.test');

    // Comparison table
    await expect(page.getByTestId('real-simulated-table')).toBeVisible();
    await expect(page.getByText('PayPal Disputes API')).toBeVisible();
    await expect(page.getByText('Policy Gate Engine')).toBeVisible();

    // Resource links
    await expect(page.getByTestId('guide-link-repo')).toBeVisible();
    await expect(page.getByTestId('guide-link-license')).toBeVisible();
    await expect(page.getByTestId('guide-link-video')).toBeVisible();
  });

  test('all internal navigation links resolve without 404', async ({ page }) => {
    await page.goto('/guide');

    // Click Disputes link in step 4
    await page.getByTestId('guide-step-4-disputes-link').click();
    await expect(page).toHaveURL(/\/app\/disputes$/);
    await expect(page.getByTestId('not-found-page')).toHaveCount(0);

    // Go back to guide
    await page.goto('/guide');
    await page.getByTestId('guide-step-4-demo-link').click();
    await expect(page).toHaveURL(/\/app\/demo$/);
    await expect(page.getByTestId('not-found-page')).toHaveCount(0);

    // View switcher quick links
    await page.goto('/guide');
    await page.getByTestId('view-link-merchant-charter').click();
    await expect(page).toHaveURL(/\/app\/charter$/);
    await expect(page.getByTestId('not-found-page')).toHaveCount(0);
  });

  test('landing and guide have no serious accessibility violations', async ({ page }) => {
    // Check Landing
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const landingAxe = await new AxeBuilder({ page }).analyze();
    const landingSerious = landingAxe.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(landingSerious, JSON.stringify(landingSerious, null, 2)).toEqual([]);

    // Check Guide
    await page.goto('/guide');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const guideAxe = await new AxeBuilder({ page }).analyze();
    const guideSerious = guideAxe.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(guideSerious, JSON.stringify(guideSerious, null, 2)).toEqual([]);
  });
});
