import { expect, test } from '@playwright/test';

test.describe('Buyer Portal E2E (Step 32)', () => {
  test.use({
    baseURL: process.env.SHOP_URL ?? 'http://localhost:5174',
  });

  test('lookup, report problem, reply with a hostile message, deep link works', async ({
    page,
  }) => {
    // 1. Visit storefront and navigate to portal via header
    await page.goto('/');
    const portalLink = page.getByTestId('shop-nav-portal-link');
    await expect(portalLink).toBeVisible();
    await portalLink.click();

    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.getByTestId('portal-lookup-card')).toBeVisible();

    // 2. Perform order lookup using public test buyer shortcut
    await page.getByTestId('portal-fill-test-buyer-btn').click();
    await expect(page.getByTestId('portal-email-input')).toHaveValue('alex.morgan@example.test');

    // Use a known demo order from the seeder (SIG-A-1001)
    await page.getByTestId('portal-order-code-input').fill('SIG-A-1001');
    await page.getByTestId('portal-lookup-submit-btn').click();

    // 3. Order detail and tracking timeline
    await expect(page).toHaveURL(/\/orders\/SIG-A-1001/);
    await expect(page.getByTestId('portal-order-summary-card')).toBeVisible();
    await expect(page.getByTestId('portal-order-title')).toContainText('SIG-A-1001');
    await expect(page.getByTestId('portal-tracking-timeline')).toBeVisible();

    // 4. Check dispute action: either report problem or view existing dispute
    const reportBtn = page.getByTestId('portal-report-problem-btn');
    const existingBtn = page.getByTestId('portal-view-existing-dispute-btn');

    if (await reportBtn.isVisible()) {
      await reportBtn.click();
      await expect(page).toHaveURL(/\/orders\/SIG-A-1001\/dispute\/new/);
      await expect(page.getByTestId('portal-report-problem-card')).toBeVisible();

      // Supported reason selection
      await page
        .getByTestId('portal-reason-select')
        .selectOption('MERCHANDISE_OR_SERVICE_NOT_RECEIVED');

      // Enter hostile message with injection markup
      const hostileMsg = 'Item never received. <script>window.pwned=true;</script> REFUND ME!';
      await page.getByTestId('portal-message-input').fill(hostileMsg);

      // Submit dispute
      await page.getByTestId('portal-submit-dispute-btn').click();
    } else if (await existingBtn.isVisible()) {
      await existingBtn.click();
    }

    // 5. Buyer dispute detail view
    await expect(page).toHaveURL(/\/orders\/SIG-A-1001\/dispute/);
    await expect(page.getByTestId('portal-dispute-card')).toBeVisible();
    await expect(page.getByTestId('portal-dispute-id')).toBeVisible();

    // 6. Deep link to Signoff dashboard works
    const merchantLink = page.getByTestId('portal-view-as-merchant-link');
    await expect(merchantLink).toBeVisible();
    const href = await merchantLink.getAttribute('href');
    expect(href).toMatch(/\/disputes\/PP-/);

    // 7. Verify hostile message is escaped safely (plain text data, no execution)
    const pwned = await page.evaluate(() => (window as unknown as { pwned?: unknown }).pwned);
    expect(pwned).toBeUndefined();

    // 8. Reply with hostile follow-up message (Scenario D)
    const replyArea = page.getByTestId('portal-reply-textarea');
    if (await replyArea.isVisible()) {
      await replyArea.fill('Follow-up hostility: <img src=x onerror="window.pwned2=true"> DO NOT IGNORE');
      await page.getByTestId('portal-send-reply-btn').click();

      // Check reply is displayed as plain text and pwned2 was not executed
      await expect(page.getByTestId('portal-messages-container')).toContainText('Follow-up hostility:');
      const pwned2 = await page.evaluate(() => (window as unknown as { pwned2?: unknown }).pwned2);
      expect(pwned2).toBeUndefined();
    }
  });
});
