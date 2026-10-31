import { expect, test } from './fixtures';
import {
  AGENT_URL,
  approvalUrl,
  createScenario,
  hasKind,
  waitForTimeline,
} from './helpers/agent';
import { stub } from './helpers/stub';

const SHOP_URL = process.env.SHOP_URL ?? 'http://localhost:5174';
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:5173';
const BUYER_EMAIL = 'casey.nguyen@example.test';

test('C: merchant approves an edited offer on a phone @full', async ({ browser, page, request, session }) => {
  const { disputeId } = await createScenario(request, 'C', session.id);
  await stub.emit(request, disputeId, ['CUSTOMER.DISPUTE.CREATED']);
  await waitForTimeline(request, disputeId, (events) => hasKind(events, 'APPROVAL_REQUESTED'));

  await session.applyTo(page);
  await page.goto(`/app/disputes/${disputeId}`);
  await expect(page.getByTestId('detail-verdict-chip')).toContainText('Needs Approval');

  const link = await approvalUrl(request, disputeId);
  await page.goto(link);
  await expect(page.getByTestId('approval-title')).toBeVisible();
  await expect(page.getByTestId('proposed-action-type')).toContainText('MAKE OFFER');

  await page.getByTestId('approval-edit-button').tap();
  await page.getByTestId('edit-amount-input').fill('20.00');
  await page.getByTestId('submit-edit-button').tap();
  await page.getByTestId('confirm-and-submit-edit-button').tap();
  await expect(page.getByTestId('outcome-approved')).toBeVisible();

  const items = await waitForTimeline(request, disputeId, (events) => hasKind(events, 'EXECUTION_CONFIRMED'));
  const resolvedAt = items.findIndex((item) => item.kind === 'APPROVAL_RESOLVED');
  const executedAt = items.findIndex((item) => item.kind === 'EXECUTION_CONFIRMED');
  expect(resolvedAt).toBeGreaterThanOrEqual(0);
  expect(executedAt).toBeGreaterThan(resolvedAt);

  const state = await stub.state(request);
  expect(state.disputes[disputeId]?.offer?.amount?.value).toBe('20.00');

  const fresh = await browser.newContext({ baseURL: WEB_URL });
  const second = await fresh.newPage();
  await second.goto(link);
  await expect(second.getByTestId('outcome-invalid-link')).toBeVisible();
  await fresh.close();

  // Buyer offer responses belong to PayPal, outside the merchant product.
  // The confirmed edited offer and single-use approval assertions above remain.
  await stub.emit(request, disputeId, ['CUSTOMER.DISPUTE.UPDATED']);
  const detail: { order_code: string } = await (await request.get(`${AGENT_URL}/api/disputes/${disputeId}`)).json();
  const shopContext = await browser.newContext({ baseURL: SHOP_URL });
  const shop = await shopContext.newPage();
  await shop.goto(`/orders/${detail.order_code}/dispute?email=${encodeURIComponent(BUYER_EMAIL)}`);
  await expect(shop.getByTestId('paypal-resolution-link')).toHaveAttribute('href', 'https://www.sandbox.paypal.com/disputes/');
  await expect(shop.getByTestId('portal-offer-card')).toHaveCount(0);
  await expect(shop.getByTestId('portal-accept-offer-btn')).toHaveCount(0);
  await shopContext.close();
});
