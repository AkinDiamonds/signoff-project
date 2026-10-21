import type { components } from '@signoff/api-client/generated';

export type Kpis = components['schemas']['KpiResponse'];
export type DisputeItem = components['schemas']['DisputeListItem'];
export type AssistantRequest = components['schemas']['AssistantRequest'];
export type AssistantResponse = components['schemas']['AssistantResponse'];

export interface StudioDisputeRow {
  id: string;
  status: string;
  reason: string;
  amount_cents: number;
  amount_display: string;
  verdict: string;
  rule_id: string;
  due_at: string;
  order_code: string;
}

export interface StudioKpiRow {
  metric: string;
  value: string;
  numeric_value: number | null;
  note: string;
}

export interface StudioData {
  sources: [
    { id: 'disputes'; data: StudioDisputeRow[] },
    { id: 'kpis'; data: StudioKpiRow[] },
  ];
}

const CENTS = /^(0|[1-9]\d*)\.(\d{2})$/;

export function amountToCents(value: string): number {
  const match = CENTS.exec(value);
  if (!match) {
    return 0;
  }
  const whole = match[1] ?? '0';
  const fraction = match[2] ?? '00';
  return Number(whole) * 100 + Number(fraction);
}

export function toStudioDisputeRows(items: readonly DisputeItem[]): StudioDisputeRow[] {
  return items.map((item) => ({
    id: item.id,
    status: item.status,
    reason: item.reason,
    amount_cents: amountToCents(item.amount.value),
    amount_display: `${item.amount.currency_code} ${item.amount.value}`,
    verdict: item.latest_verdict ?? 'PENDING',
    rule_id: item.latest_rule_id ?? '',
    due_at: item.seller_response_due_date ?? '',
    order_code: item.order_code ?? '',
  }));
}

export function toStudioKpiRows(kpis: Kpis): StudioKpiRow[] {
  const share =
    kpis.share_auto_resolved === null || kpis.share_auto_resolved === undefined
      ? null
      : Math.round(kpis.share_auto_resolved * 100);
  return [
    {
      metric: 'Open disputes',
      value: String(kpis.open_disputes),
      numeric_value: kpis.open_disputes,
      note: 'Waiting for the seller or a human approval',
    },
    {
      metric: 'Dollars at risk',
      value: `USD ${kpis.dollars_at_risk}`,
      numeric_value: amountToCents(kpis.dollars_at_risk),
      note: 'Open USD disputes only',
    },
    {
      metric: 'Recovered',
      value: `USD ${kpis.recovered}`,
      numeric_value: amountToCents(kpis.recovered),
      note: 'Resolved in the merchant favor',
    },
    {
      metric: 'Conceded',
      value: `USD ${kpis.conceded}`,
      numeric_value: amountToCents(kpis.conceded),
      note: 'Refunded or conceded',
    },
    {
      metric: 'Share auto-resolved',
      value: share === null ? 'No closed disputes' : `${share}%`,
      numeric_value: share,
      note: 'Closed without human approval',
    },
    {
      metric: 'Estimated hours saved',
      value:
        kpis.estimated_hours_saved === null || kpis.estimated_hours_saved === undefined
          ? 'No closed disputes'
          : `${kpis.estimated_hours_saved} h`,
      numeric_value: kpis.estimated_hours_saved ?? null,
      note: `Assumes ${kpis.assumed_minutes_per_dispute} min per dispute`,
    },
  ];
}

export function toStudioData(kpis: Kpis, items: readonly DisputeItem[]): StudioData {
  return {
    sources: [
      { id: 'disputes', data: toStudioDisputeRows(items) },
      { id: 'kpis', data: toStudioKpiRows(kpis) },
    ],
  };
}

export const SAMPLE_QUESTIONS: readonly string[] = [
  'How many disputes are open, and how much is at risk?',
  'Which disputes are due soon?',
  'What share of closed disputes was auto-resolved?',
];

export function buildAssistantRequest(question: string, kpis: Kpis, items: readonly DisputeItem[]): AssistantRequest {
  const context = {
    kpis: toStudioKpiRows(kpis),
    disputes: toStudioDisputeRows(items).slice(0, 20),
  };
  return {
    messages: [
      {
        role: 'user',
        content: `Dashboard data (JSON):\n${JSON.stringify(context)}\n\nQuestion: ${question}`,
      },
    ],
  };
}
