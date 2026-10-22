import { expect, type APIRequestContext } from '@playwright/test';
import type { components } from '@signoff/api-client/generated';

export const AGENT_URL = process.env.AGENT_URL ?? 'http://localhost:8000';

export const BUYER_EMAIL = 'alex.morgan@example.test';

export type ScenarioId = 'A' | 'B' | 'C' | 'D' | 'E';
export type TimelineItem = components['schemas']['TimelineResponse']['items'][number];
export type DisputeDetail = components['schemas']['DisputeDetailResponse'];

export async function newSession(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${AGENT_URL}/api/demo/reset`);
  const body: { session_id: string } = await res.json();
  return body.session_id;
}

export async function createScenario(
  request: APIRequestContext,
  scenario: ScenarioId,
  sessionId: string,
): Promise<{ disputeId: string; sessionId: string }> {
  const res = await request.post(`${AGENT_URL}/api/demo/scenarios/${scenario}`, {
    headers: { 'X-Demo-Session': sessionId, 'Idempotency-Key': crypto.randomUUID() },
  });
  expect(res.status(), await res.text()).toBe(201);
  const body: { dispute_id: string; session_id: string } = await res.json();
  return { disputeId: body.dispute_id, sessionId: body.session_id };
}

export async function getTimeline(request: APIRequestContext, disputeId: string): Promise<TimelineItem[]> {
  const res = await request.get(`${AGENT_URL}/api/disputes/${disputeId}/timeline?limit=100`);
  expect(res.ok()).toBeTruthy();
  const body: components['schemas']['TimelineResponse'] = await res.json();
  return body.items;
}

export async function waitForTimeline(
  request: APIRequestContext,
  disputeId: string,
  predicate: (items: TimelineItem[]) => boolean,
): Promise<TimelineItem[]> {
  let items: TimelineItem[] = [];
  await expect
    .poll(async () => {
      items = await getTimeline(request, disputeId);
      return predicate(items);
    }, { timeout: 30000, intervals: [250, 500, 1000] })
    .toBe(true);
  return items;
}

export async function waitForDispute(
  request: APIRequestContext,
  disputeId: string,
  predicate: (dispute: DisputeDetail) => boolean,
): Promise<DisputeDetail> {
  let dispute: DisputeDetail | null = null;
  await expect
    .poll(async () => {
      const res = await request.get(`${AGENT_URL}/api/disputes/${disputeId}`);
      const current: DisputeDetail = await res.json();
      dispute = current;
      return predicate(current);
    }, { timeout: 30000, intervals: [250, 500, 1000] })
    .toBe(true);
  if (dispute === null) {
    throw new Error(`Dispute ${disputeId} was not readable.`);
  }
  return dispute;
}

export function hasKind(items: TimelineItem[], kind: string): boolean {
  return items.some((item) => item.kind === kind);
}

export function countKind(items: TimelineItem[], kind: string): number {
  return items.filter((item) => item.kind === kind).length;
}

export async function approvalUrl(request: APIRequestContext, disputeId: string): Promise<string> {
  let url = '';
  await expect
    .poll(async () => {
      const res = await request.get(`${AGENT_URL}/__test__/approval-links?dispute_id=${disputeId}`);
      const body: { url: string | null } = await res.json();
      url = body.url ?? '';
      return url;
    }, { timeout: 30000, intervals: [250, 500, 1000] })
    .not.toBe('');
  return url;
}

export async function createShopOrder(
  request: APIRequestContext,
  sessionId: string,
  items: { sku: string; quantity: number }[],
): Promise<string> {
  const res = await request.post(`${AGENT_URL}/api/shop/orders`, {
    headers: { 'X-Demo-Session': sessionId },
    data: { customer_email: BUYER_EMAIL, items, demo_session_id: sessionId },
  });
  expect(res.status(), await res.text()).toBe(201);
  const created: { order_code: string; paypal_order_id: string } = await res.json();
  await request.post(`${AGENT_URL}/api/shop/orders/${created.order_code}/capture`, {
    data: { paypal_order_id: created.paypal_order_id },
  });
  return created.order_code;
}

export async function createBuyerDispute(
  request: APIRequestContext,
  orderCode: string,
  message: string,
  amount: string,
): Promise<string> {
  const res = await request.post(`${AGENT_URL}/api/shop/orders/${orderCode}/dispute`, {
    data: {
      customer_email: BUYER_EMAIL,
      reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
      amount: { value: amount, currency_code: 'USD' },
      message,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const body: { id: string } = await res.json();
  return body.id;
}
