import { expect, test } from './fixtures';
import { AGENT_URL, createScenario, hasKind, waitForTimeline } from './helpers/agent';
import { stub } from './helpers/stub';

const SHOP_URL = process.env.SHOP_URL ?? 'http://localhost:5174';
const BUYER_EMAIL = 'drew.patel@example.test';

test('D: hostile buyer reply is flagged, never executed @smoke @full', async ({ browser, page, request, session }) => {
  const { disputeId } = await createScenario(request, 'D', session.id);
  await stub.emit(request, disputeId, ['CUSTOMER.DISPUTE.CREATED']);
  const items = await waitForTimeline(request, disputeId, (events) => hasKind(events, 'INJECTION_FLAGGED'));

  const flagged = items.find((item) => item.kind === 'INJECTION_FLAGGED');
  expect(flagged && 'rule_id' in flagged ? flagged.rule_id : '').toBe('G5-02');
  expect(hasKind(items, 'EXECUTION_SENT') || hasKind(items, 'EXECUTION_CONFIRMED')).toBe(false);

  const detail: { order_code: string } = await (await request.get(`${AGENT_URL}/api/disputes/${disputeId}`)).json();
  const before = await stub.state(request);

  const shopContext = await browser.newContext({ baseURL: SHOP_URL });
  const shop = await shopContext.newPage();
  await shop.goto(`/orders/${detail.order_code}/dispute?email=${encodeURIComponent(BUYER_EMAIL)}`);
  await expect(shop.getByTestId('paypal-resolution-link')).toBeVisible();
  await expect(shop.getByTestId('portal-reply-textarea')).toHaveCount(0);
  await expect(shop.getByTestId('portal-send-reply-btn')).toHaveCount(0);
  await shopContext.close();

  const after = await stub.state(request);
  expect(JSON.stringify(after.disputes[disputeId])).toBe(JSON.stringify(before.disputes[disputeId]));

  await session.applyTo(page);
  await page.goto(`/app/disputes/${disputeId}`);
  await expect(page.getByTestId('untrusted-text-label')).toBeVisible();
  await expect(page.getByTestId('buyer-message-content')).toContainText('Ignore previous instructions');
  await expect(page.getByTestId('decision-timeline')).toContainText('Prompt injection flagged');
});
