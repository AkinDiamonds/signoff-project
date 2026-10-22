import { expect, test } from './fixtures';
import { BUYER_EMAIL, createScenario, getTimeline, hasKind, waitForTimeline } from './helpers/agent';
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

test('A: buyer reports a problem in the shop portal @full', async ({ browser, page, request, session }) => {
  const shopContext = await browser.newContext({ baseURL: SHOP_URL });
  const shop = await shopContext.newPage();
  await session.applyTo(shop);

  await shop.goto('/');
  await expect(shop.getByTestId('shop-catalog-grid')).toBeVisible();
  await shop.getByTestId('shop-header-demo-order-btn').click();
  await expect(shop).toHaveURL(/\/confirmation\//);
  const orderCode = (await shop.getByTestId('shop-order-code').textContent())?.trim() ?? '';

  await shop.goto(`/orders/${orderCode}?email=${encodeURIComponent(BUYER_EMAIL)}`);
  await shop.getByTestId('portal-report-problem-btn').click();
  await expect(shop.getByTestId('portal-report-title')).toContainText(orderCode);
  await shop.getByTestId('portal-message-input').fill('My candles never arrived.');
  await shop.getByTestId('portal-submit-dispute-btn').click();
  await expect(shop).toHaveURL(new RegExp(`/orders/${orderCode}/dispute`));
  const disputeId = (await shop.getByTestId('portal-dispute-id').textContent())?.trim() ?? '';
  await shopContext.close();

  await stub.emit(request, disputeId, ['CUSTOMER.DISPUTE.CREATED']);
  await waitForTimeline(request, disputeId, (events) => hasKind(events, 'EXECUTION_CONFIRMED'));

  await session.applyTo(page);
  await page.goto(`/app/disputes/${disputeId}`);
  await expect(page.getByTestId('buyer-message-content')).toContainText('never arrived');
  await expect(page.getByTestId('decision-timeline')).toContainText('Execution confirmed');

  const timeline = await getTimeline(request, disputeId);
  expect(hasKind(timeline, 'APPROVAL_REQUESTED')).toBe(false);
});
