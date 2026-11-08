import { expect, test } from './fixtures';
import type { components } from '@signoff/api-client/generated';
import {
  AGENT_URL,
  approvalUrl,
  createBuyerDispute,
  createScenario,
  createShopOrder,
  hasKind,
  waitForTimeline,
} from './helpers/agent';
import { stub } from './helpers/stub';

const SHOP_URL = process.env.SHOP_URL ?? 'http://localhost:5174';
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:5173';
const BUYER_EMAIL = 'casey.nguyen@example.test';

for (const policy of ['HUMAN_REVIEW', 'GATED_SETTLEMENT']) {
  test(`withheld $300 tracking opens a refund approval under ${policy} @full`, async ({ page, request, session }) => {
    const original: components['schemas']['CharterResponse'] = await (await request.get(`${AGENT_URL}/api/charter`)).json();
    const changed = await request.put(`${AGENT_URL}/api/charter`, {
      data: { ...original, version: undefined, created_at: undefined, base_version: original.version, missing_delivery_policy: policy },
    });
    expect(changed.status(), await changed.text()).toBe(200);
    try {
      const orderCode = await createShopOrder(request, session.id, [{ sku: 'GIFT-SET-01', quantity: 5 }]);
      const scope = `?demo_session_id=${encodeURIComponent(session.id)}`;
      const shipments: components['schemas']['ShipmentView'][] = await (await request.get(`${AGENT_URL}/api/fulfillment/orders${scope}`)).json();
      const shipment = shipments.find(item => item.order_code === orderCode);
      if (!shipment) throw new Error('Expected the newly paid simulated shipment');
      const withheld = await request.post(`${AGENT_URL}/api/fulfillment/orders/${orderCode}/actions${scope}`, {
        data: { action: 'missing_tracking', base_version: shipment.version, request_id: crypto.randomUUID() },
      });
      expect(withheld.status(), await withheld.text()).toBe(200);
      const disputeId = await createBuyerDispute(request, orderCode, 'My order has not arrived.', '300.00');
      await stub.emit(request, disputeId);
      const pending = await waitForTimeline(request, disputeId, events => hasKind(events, 'APPROVAL_REQUESTED'));
      expect(pending.filter(item => item.kind === 'APPROVAL_REQUESTED')).toHaveLength(1);
      expect(pending.filter(item => item.kind === 'EXECUTION_INTENDED')).toHaveLength(0);
      expect((await stub.state(request)).disputes[disputeId]?.status).toBe('WAITING_FOR_SELLER_RESPONSE');
      await session.applyTo(page);
      await page.goto(`/app/disputes/${disputeId}`);
      await expect(page.getByTestId('open-approval-card-button')).toBeVisible();
      await page.reload();
      await page.getByTestId('open-approval-card-button').tap();
      await expect(page.getByTestId('proposed-action-type')).toContainText('ACCEPT CLAIM');
      await expect(page.getByTestId('approval-dispute-amount')).toContainText('300');
      await page.getByTestId('approval-approve-button').tap();
      await expect(page.getByTestId('outcome-approved')).toBeVisible();
      const sent = await waitForTimeline(request, disputeId, events => hasKind(events, 'EXECUTION_CONFIRMED'));
      expect(sent.filter(item => item.kind === 'EXECUTION_INTENDED')).toHaveLength(1);
      expect((await stub.state(request)).disputes[disputeId]?.status).toBe('RESOLVED');
    } finally {
      const latest: components['schemas']['CharterResponse'] = await (await request.get(`${AGENT_URL}/api/charter`)).json();
      const restored = await request.put(`${AGENT_URL}/api/charter`, {
        data: { ...original, version: undefined, created_at: undefined, base_version: latest.version },
      });
      expect(restored.status(), await restored.text()).toBe(200);
    }
  });
}

test('C: unchanged approval reaches the stub provider once @full', async ({ page, request, session }) => {
  const { disputeId } = await createScenario(request, 'C', session.id);
  await stub.emit(request, disputeId, ['CUSTOMER.DISPUTE.CREATED']);
  const pending = await waitForTimeline(request, disputeId, (events) => hasKind(events, 'APPROVAL_REQUESTED'));
  expect(pending.filter(item => item.kind === 'EXECUTION_INTENDED')).toHaveLength(0);
  expect((await stub.state(request)).disputes[disputeId]?.offer?.amount).toBeFalsy();
  await session.applyTo(page);
  const link = await approvalUrl(request, disputeId);
  await page.goto(link);
  await page.getByTestId('approval-approve-button').tap();
  await expect(page.getByTestId('outcome-approved')).toBeVisible();
  const items = await waitForTimeline(request, disputeId, (events) => hasKind(events, 'EXECUTION_CONFIRMED'));
  expect(items.filter(item => item.kind === 'EXECUTION_INTENDED')).toHaveLength(1);
  expect((await stub.state(request)).disputes[disputeId]?.offer).toBeTruthy();
  await page.goto(`/app/disputes/${disputeId}`);
  await page.getByRole('tab', { name: 'Activity' }).tap();
  await expect(page.getByTestId('activity-summary')).toBeVisible();
  await expect(page.getByTestId('decision-timeline')).not.toBeVisible();
  await page.getByText('Technical details', { exact: true }).first().click();
  await expect(page.getByTestId('decision-timeline')).toContainText('Approval recorded');
  await expect(page.getByTestId('decision-timeline')).toContainText('Confirmation recorded');
  await page.reload();
  await page.getByRole('tab', { name: 'Activity' }).tap();
  await page.getByText('Technical details', { exact: true }).first().click();
  await expect(page.getByTestId('decision-timeline')).toContainText('Approval recorded');
  await expect(page.getByTestId('decision-timeline')).toContainText('Confirmation recorded');
});

test('C: merchant approves an edited offer on a phone @full', async ({ browser, page, request, session }) => {
  const { disputeId } = await createScenario(request, 'C', session.id);
  await stub.emit(request, disputeId, ['CUSTOMER.DISPUTE.CREATED']);
  await waitForTimeline(request, disputeId, (events) => hasKind(events, 'APPROVAL_REQUESTED'));

  await session.applyTo(page);
  await page.goto(`/app/disputes/${disputeId}`);
  await expect(page.getByTestId('detail-verdict-chip')).toContainText('Needs review');

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
