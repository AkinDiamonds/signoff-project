import type { components } from '@signoff/api-client/generated';

type Kpis = components['schemas']['KpiResponse'];
type Disputes = components['schemas']['DisputesResponse'];

export const kpisFixture = {
  assumed_minutes_per_dispute: 20,
  auto_resolved_disputes: 1,
  closed_disputes: 2,
  conceded: '0.00',
  dollars_at_risk: '149.50',
  estimated_hours_saved: 0.67,
  non_usd_open_disputes: 0,
  open_disputes: 2,
  other_currency_open_disputes: {},
  recovered: '42.00',
  share_auto_resolved: 0.5,
} satisfies Kpis;

export const disputesFixture = {
  items: [
    {
      id: 'PP-D-1001',
      status: 'WAITING_FOR_SELLER_RESPONSE',
      reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
      amount: { value: '42.00', currency_code: 'USD' },
      state_fingerprint: 'fp-1001',
      created_at: '2026-10-19T09:00:00Z',
      updated_at: '2026-10-20T10:00:00Z',
      latest_rule_id: 'G2-01',
      latest_verdict: 'ALLOW',
      order_code: 'ORD0000001',
      seller_response_due_date: '2026-10-26T09:00:00Z',
    },
    {
      id: 'PP-D-1002',
      status: 'WAITING_FOR_SELLER_RESPONSE',
      reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
      amount: { value: '107.50', currency_code: 'USD' },
      state_fingerprint: 'fp-1002',
      created_at: '2026-10-18T12:30:00Z',
      updated_at: '2026-10-20T08:15:00Z',
      latest_rule_id: 'G1-02',
      latest_verdict: 'NEEDS_APPROVAL',
      order_code: 'ORD0000002',
      seller_response_due_date: null,
    },
  ],
  next_cursor: null,
  total_count: 2,
} satisfies Disputes;

export const statusFixture = {
  status: 'ok',
  env: 'local',
  paypal_env: 'stub',
  llm_mode: 'CACHED',
  demo_frozen: false,
  queue_depth: 0,
  dead_letter_count: 0,
};
