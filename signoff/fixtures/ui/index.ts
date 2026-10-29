import type { components } from '@signoff/api-client/generated';

type Kpis = components['schemas']['KpiResponse'];
type Disputes = components['schemas']['DisputesResponse'];
type DisputeDetail = components['schemas']['DisputeDetailResponse'];
type Timeline = components['schemas']['TimelineResponse'];
type ApprovalCard = components['schemas']['ApprovalCardResponse'];

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

export const disputeDetailFixture: DisputeDetail = {
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
  snapshot: {
    buyer_message: 'Package did not arrive on time. <script>alert("xss")</script>',
    evidence: {
      evidence_strength: 'high',
      carrier: 'USPS',
      tracking_number: '9400111899223190001234',
      status: 'DELIVERED',
      delivered_at: '2026-10-18T14:30:00Z',
    },
  },
};

export const disputeDetailNeedsApprovalFixture: DisputeDetail = {
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
  snapshot: {
    buyer_message: 'I would like a partial refund since the item arrived damaged.',
  },
};

export const disputeDetailInProgressFixture: DisputeDetail = {
  id: 'PP-D-1003',
  status: 'WAITING_FOR_SELLER_RESPONSE',
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  amount: { value: '65.00', currency_code: 'USD' },
  state_fingerprint: 'fp-1003',
  created_at: '2026-10-21T10:00:00Z',
  updated_at: '2026-10-21T10:01:00Z',
  latest_rule_id: null,
  latest_verdict: null,
  order_code: 'ORD0000003',
  seller_response_due_date: null,
  snapshot: {
    buyer_message: 'Where is my order? Please check.',
  },
};

export const disputeTimelineFixture: Timeline = {
  items: [
    {
      id: 'evt-1',
      dispute_id: 'PP-D-1001',
      sequence_number: 1,
      kind: 'WEBHOOK_RECEIVED',
      created_at: '2026-10-19T09:00:00Z',
      is_truncated: false,
      payload: { event_type: 'CUSTOMER.DISPUTE.CREATED' },
    },
    {
      id: 'evt-2',
      dispute_id: 'PP-D-1001',
      sequence_number: 2,
      kind: 'DISPUTE_SYNCED',
      created_at: '2026-10-19T09:00:05Z',
      is_truncated: false,
      status: 'WAITING_FOR_SELLER_RESPONSE',
    },
    {
      id: 'evt-3',
      dispute_id: 'PP-D-1001',
      sequence_number: 3,
      kind: 'RUN_STARTED',
      created_at: '2026-10-19T09:00:10Z',
      is_truncated: false,
      run_id: 'run-1001',
    },
    {
      id: 'evt-4',
      dispute_id: 'PP-D-1001',
      sequence_number: 4,
      kind: 'EVIDENCE_BUILT',
      created_at: '2026-10-19T09:00:15Z',
      is_truncated: false,
      evidence_strength: 'high',
    },
    {
      id: 'evt-5',
      dispute_id: 'PP-D-1001',
      sequence_number: 5,
      kind: 'PLAN_PROPOSED',
      created_at: '2026-10-19T09:00:20Z',
      is_truncated: false,
      action_type: 'PROVIDE_EVIDENCE',
    },
    {
      id: 'evt-6',
      dispute_id: 'PP-D-1001',
      sequence_number: 6,
      kind: 'GATE_DECIDED',
      created_at: '2026-10-19T09:00:25Z',
      is_truncated: false,
      verdict: 'ALLOW',
      rule_id: 'G2-01',
    },
    {
      id: 'evt-7',
      dispute_id: 'PP-D-1001',
      sequence_number: 7,
      kind: 'EXECUTION_CONFIRMED',
      created_at: '2026-10-19T09:00:30Z',
      is_truncated: false,
      external_id: 'pp-ack-1001',
    },
  ],
  next_cursor: null,
};

// Deadlines are relative to now so this fixture never expires and breaks the tests.
const hoursFromNow = (hours: number): string =>
  new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

export const approvalCardFixture: ApprovalCard = {
  id: 'appr-1001',
  decision_id: 'dec-1001',
  dispute_id: 'PP-D-1002',
  token_hash: 'thash-1002',
  payload_hash: 'phash-1002',
  action_type: 'MAKE_OFFER',
  action_payload: {
    amount: { value: '50.00', currency_code: 'USD' },
    message: 'We offer a partial refund of $50.00.',
  },
  verdict: 'NEEDS_APPROVAL',
  rule_id: 'G1-02',
  reason: 'Offer amount exceeds auto-offer charter limit of $25.00',
  expires_at: hoursFromNow(20),
  resolution: 'PENDING',
  notes: null,
  dispute: {
    id: 'PP-D-1002',
    amount: { value: '107.50', currency_code: 'USD' },
    reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
    status: 'WAITING_FOR_SELLER_RESPONSE',
    seller_response_due_date: hoursFromNow(30),
    buyer_message: 'The package never arrived at my door.',
  },
  created_at: '2026-10-20T08:15:00Z',
  resolved_at: null,
};

export const statusFixture = {
  status: 'ok',
  env: 'local',
  paypal_env: 'stub',
  llm_mode: 'CACHED',
  demo_frozen: false,
  queue_depth: 0,
  dead_letter_count: 0,
};

type Charter = components['schemas']['CharterResponse'];
type DemoPool = components['schemas']['PoolResponse'];

export const charterFixture = {
  version: 1,
  created_at: '2026-10-20T09:00:00Z',
  auto_offer_max: { currency_code: 'USD', value: '25.00' },
  auto_accept_max: { currency_code: 'USD', value: '25.00' },
  auto_act_max_dispute_amount: { currency_code: 'USD', value: '100.00' },
  never_auto_reasons: [],
  never_auto_actions: ['ESCALATE', 'APPEAL'],
  repeat_disputer_threshold: 2,
  auto_provide_evidence: true,
  auto_send_message: true,
} satisfies Charter;

export const charterHistoryFixture = [charterFixture] satisfies Charter[];

export const demoPoolFixture = {
  total: 15,
  available: 15,
  claimed: 0,
  by_scenario: {
    A: { total: 3, available: 3, claimed: 0 },
    B: { total: 3, available: 3, claimed: 0 },
    C: { total: 3, available: 3, claimed: 0 },
    D: { total: 3, available: 3, claimed: 0 },
    E: { total: 3, available: 3, claimed: 0 },
  },
} satisfies DemoPool;
