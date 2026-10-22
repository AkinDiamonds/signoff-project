import { expect, test } from './fixtures';
import {
  createBuyerDispute,
  createScenario,
  createShopOrder,
  getTimeline,
  hasKind,
  waitForTimeline,
} from './helpers/agent';
import { stub } from './helpers/stub';

const FROZEN_AGENT_URL = process.env.FROZEN_AGENT_URL ?? 'http://localhost:8001';
const FROZEN_WEB_URL = process.env.FROZEN_WEB_URL ?? 'http://localhost:5175';

test('resilience: duplicate webhook is deduplicated into one run @full', async ({ request, session }) => {
  await stub.faults(request, { duplicate_delivery: true });
  try {
    const { disputeId } = await createScenario(request, 'A', session.id);
    await stub.emit(request, disputeId, ['CUSTOMER.DISPUTE.CREATED']);
    await waitForTimeline(request, disputeId, (events) => hasKind(events, 'EXECUTION_CONFIRMED'));

    const items = await getTimeline(request, disputeId);
    expect(items.filter((item) => item.kind === 'RUN_STARTED')).toHaveLength(1);
    expect(items.filter((item) => item.kind === 'WEBHOOK_RECEIVED')).toHaveLength(1);
  } finally {
    await stub.faults(request, { duplicate_delivery: false });
  }
});

test('resilience: the poller syncs a dispute with no webhook @full', async ({ request, session }) => {
  const { disputeId } = await createScenario(request, 'A', session.id);
  const items = await waitForTimeline(request, disputeId, (events) => hasKind(events, 'DISPUTE_SYNCED'));
  expect(hasKind(items, 'WEBHOOK_RECEIVED')).toBe(false);
});

test('resilience: LLM failure records RUN_FAILED and executes nothing @full', async ({ page, request, session }) => {
  const orderCode = await createShopOrder(request, session.id, [{ sku: 'CND-CED-03', quantity: 1 }]);
  const disputeId = await createBuyerDispute(request, orderCode, 'FAIL_LLM: please refund this order.', '64.00');
  await stub.emit(request, disputeId, ['CUSTOMER.DISPUTE.CREATED']);

  const items = await waitForTimeline(request, disputeId, (events) => hasKind(events, 'RUN_FAILED'));
  expect(hasKind(items, 'APPROVAL_REQUESTED')).toBe(false);
  expect(hasKind(items, 'EXECUTION_SENT') || hasKind(items, 'EXECUTION_CONFIRMED')).toBe(false);

  await session.applyTo(page);
  await page.goto(`/app/disputes/${disputeId}`);
  await expect(page.getByTestId('decision-timeline')).toContainText('Run failed');
});

test('resilience: kill switch blocks scenarios and charter edits @smoke @full', async ({ page, request }) => {
  const frozen = await request.post(`${FROZEN_AGENT_URL}/api/demo/scenarios/A`, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  expect(frozen.status()).toBe(503);
  const body: { error: { code: string } } = await frozen.json();
  expect(body.error.code).toBe('FROZEN');

  await page.goto(`${FROZEN_WEB_URL}/app/demo`);
  await expect(page.getByTestId('demo-frozen-banner')).toBeVisible();

  await page.goto(`${FROZEN_WEB_URL}/app/charter`);
  await page.getByLabel('Auto-offer maximum (USD)').fill('10');
  await page.getByTestId('charter-save-button').click();
  await expect(page.getByTestId('charter-save-error')).toContainText(/frozen/i);
});
