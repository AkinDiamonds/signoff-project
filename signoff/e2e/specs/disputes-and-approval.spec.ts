import { expect, test } from '@playwright/test';

test.describe('Disputes and Approval UI (Steps 25 & 26)', () => {
  test('open dispute detail from list, verify timeline order and untrusted markup stays text', async ({
    page,
  }) => {
    // 1. Open disputes list
    await page.goto('/app/disputes');
    await expect(page.getByRole('heading', { name: 'Disputes' })).toBeVisible();

    // 2. Click dispute link to open detail
    const disputeLink = page.getByTestId('dispute-link-PP-D-1001');
    await expect(disputeLink).toBeVisible();
    await disputeLink.click();

    // 3. Verify detail page loaded
    await expect(page).toHaveURL(/\/app\/disputes\/PP-D-1001$/);
    await expect(page.getByTestId('dispute-detail-id')).toContainText('PP-D-1001');

    // 4. Verify evidence strength badge
    await expect(page.getByTestId('evidence-strength-badge')).toHaveText(/high/i);

    // 5. Injected markup stays text and is labeled untrusted
    await expect(page.getByTestId('untrusted-text-label')).toBeVisible();
    const messageContent = page.getByTestId('buyer-message-content');
    await expect(messageContent).toContainText('<script>alert("xss")</script>');

    // 6. Timeline order: event 1 before event 2
    const timeline = page.getByTestId('decision-timeline');
    await expect(timeline).toBeVisible();
    const event1 = page.getByTestId('timeline-event-1');
    const event2 = page.getByTestId('timeline-event-2');
    await expect(event1).toBeVisible();
    await expect(event2).toBeVisible();
  });

  test('mobile approval flow: approve proposed action', async ({ page }) => {
    await page.goto('/approve/sample-token-12345678901234567890');
    await expect(page.getByTestId('approval-title')).toBeVisible();
    await expect(page.getByTestId('proposed-action-type')).toContainText('MAKE OFFER');
    await expect(page.getByTestId('approval-evidence-card')).toBeVisible();

    // Approve
    const approveBtn = page.getByTestId('approval-approve-button');
    await approveBtn.click();

    // Outcome confirmed
    await expect(page.getByTestId('outcome-approved')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Approval confirmed' })).toBeVisible();
  });

  test('mobile approval flow: deny with reason', async ({ page }) => {
    await page.goto('/approve/sample-token-12345678901234567890');
    await expect(page.getByTestId('approval-deny-button')).toBeVisible();

    await page.getByTestId('approval-deny-button').click();
    await expect(page.getByTestId('approval-deny-card')).toBeVisible();

    await page.getByTestId('deny-reason-input').fill('Customer claim is fraudulent');
    await page.getByTestId('confirm-deny-button').click();

    await expect(page.getByTestId('outcome-denied')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Action denied' })).toBeVisible();
  });

  test('mobile approval flow: edit then approve with confirmation step', async ({ page }) => {
    await page.goto('/approve/sample-token-12345678901234567890');
    await page.getByTestId('approval-edit-button').click();

    await expect(page.getByTestId('approval-edit-card')).toBeVisible();
    await page.getByTestId('edit-amount-input').fill('20.00');
    await page.getByTestId('submit-edit-button').click();

    // Confirmation step for money-moving action
    await expect(page.getByTestId('approval-confirm-edit-card')).toBeVisible();
    await expect(page.getByTestId('confirmed-amount')).toContainText('$20.00 USD');

    await page.getByTestId('confirm-and-submit-edit-button').click();
    await expect(page.getByTestId('outcome-approved')).toBeVisible();
  });

  test('mobile approval flow: expired link and invalid link outcomes', async ({ page }) => {
    // Expired link
    await page.goto('/approve/expired-token');
    await expect(page.getByTestId('outcome-expired')).toBeVisible();

    // Invalid link
    await page.goto('/approve/invalid-token');
    await expect(page.getByTestId('outcome-invalid-link')).toBeVisible();
  });

  test('mobile approval flow: double click does not duplicate resolution', async ({ page }) => {
    await page.goto('/approve/sample-token-double-click-test');
    await expect(page.getByTestId('approval-approve-button')).toBeVisible();
    await page.getByTestId('approval-approve-button').dblclick();
    await expect(page.getByTestId('outcome-approved')).toBeVisible();
  });

  test('mobile approval flow: back navigation after resolution displays already-resolved', async ({ page }) => {
    const token = 'sample-token-back-nav-test';
    await page.goto(`/approve/${token}`);
    await expect(page.getByTestId('approval-approve-button')).toBeVisible();
    await page.getByTestId('approval-approve-button').click();
    await expect(page.getByTestId('outcome-approved')).toBeVisible();

    // Navigate to dashboard
    await page.goto('/app/disputes');
    // Navigate back to approval page
    await page.goBack();

    // Must show already resolved outcome, no approve button
    await expect(page.getByTestId('outcome-already-resolved')).toBeVisible();
    await expect(page.getByTestId('approval-approve-button')).not.toBeVisible();
  });

  test('mobile approval card renders cleanly on 320px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/approve/sample-token-320px-test');
    await expect(page.getByTestId('approval-title')).toBeVisible();
    await expect(page.getByTestId('approval-evidence-card')).toBeVisible();
    await expect(page.getByTestId('approval-approve-button')).toBeVisible();
  });
});
