import { expect, test } from './fixtures';
import { createScenario, hasKind, waitForTimeline } from './helpers/agent';
import { stub } from './helpers/stub';

const SHOP_URL = process.env.SHOP_URL ?? 'http://localhost:5174';

test('A: evidence submitted and execution confirmed @smoke @full', async ({ page, request, session }) => {
  await session.applyTo(page);
  const { disputeId } = await createScenario(request, 'A', session.id);
  await stub.emit(request, disputeId, ['CUSTOMER.DISPUTE.CREATED']);

  const items = await waitForTimeline(request, disputeId, (events) => hasKind(events, 'EXECUTION_CONFIRMED'));
  expect(hasKind(items, 'GATE_DECIDED')).toBe(true);

  await page.goto(`/app/disputes/${disputeId}`);
  await expect(page.getByTestId('dispute-detail-id')).toContainText(disputeId);
  await expect(page.getByTestId('decision-timeline')).toBeVisible();
  await expect(page.getByTestId('evidence-strength-badge')).toBeVisible();
  await expect(page.getByTestId('detail-verdict-chip')).toContainText('Allow');

  const state = await stub.state(request);
  expect(state.disputes[disputeId]?.evidences).toHaveLength(1);
});

test('Shop sends buyers to PayPal Resolution Center @full', async ({ browser }) => {
  const shopContext = await browser.newContext({ baseURL: SHOP_URL });
  const shop = await shopContext.newPage();
  const writes: string[] = [];
  shop.on('request', request => {
    if (request.method() === 'POST') writes.push(request.url());
  });
  await shop.goto('/orders/SIGEXTERNAL/dispute/new');
  await expect(shop.getByTestId('paypal-resolution-link')).toHaveAttribute('href', 'https://www.sandbox.paypal.com/disputes/');
  await expect(shop.getByRole('textbox')).toHaveCount(0);
  expect(writes).toEqual([]);
  await shopContext.close();
});
