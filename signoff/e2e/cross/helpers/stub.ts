import type { APIRequestContext } from '@playwright/test';

const STUB_URL = process.env.STUB_URL ?? 'http://localhost:4010';

export interface StubFaults {
  duplicate_delivery?: boolean;
  out_of_order?: boolean;
  delivery_delay_seconds?: number;
  fail_next_calls?: number;
}

export interface StubDispute {
  status?: string;
  messages?: { content?: string }[];
  evidences?: unknown[];
  offer?: { status?: string; amount?: { value?: string } };
}

export interface StubState {
  disputes: Record<string, StubDispute>;
  orders: Record<string, unknown>;
  config: Record<string, unknown>;
}

export const stub = {
  async faults(request: APIRequestContext, faults: StubFaults): Promise<void> {
    await request.post(`${STUB_URL}/__stub__/faults`, { data: faults });
  },
  async emit(
    request: APIRequestContext,
    disputeId: string,
    eventTypes: string[] = ['CUSTOMER.DISPUTE.CREATED'],
  ): Promise<void> {
    const res = await request.post(`${STUB_URL}/__stub__/webhooks`, {
      data: { dispute_id: disputeId, event_types: eventTypes },
    });
    if (!res.ok()) throw new Error(`stub emit failed (${res.status()}): ${await res.text()}`);
  },
  async state(request: APIRequestContext): Promise<StubState> {
    const res = await request.get(`${STUB_URL}/__stub__/state`);
    return (await res.json()) as StubState;
  },
};
