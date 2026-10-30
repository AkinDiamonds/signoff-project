import { useQuery } from '@tanstack/react-query';
import type { components, paths } from '@signoff/api-client/generated';
import { apiClient } from '../../app/api';
import { ApiQueryError, unwrap } from '../../app/queries';
import type { DemoPool, ScenarioCreated } from './types';

const SESSION_KEY = 'signoff.demo.session';
const IDEMPOTENCY_PREFIX = 'signoff.demo.idempotency.';
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

type ResetResponse = components['schemas']['ResetResponse'];
type PoolPath = paths['/api/demo/pool']['get']['responses']['200']['content']['application/json'];
type CreatePath = paths['/api/demo/scenarios/{scenario_id}']['post']['responses']['201']['content']['application/json'];
type ResetPath = paths['/api/demo/reset']['post']['responses']['200']['content']['application/json'];

function readSessionValue(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionValue(key: string, value: string | null): void {
  try {
    if (value === null) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, value);
    }
  } catch {
    // Storage can be unavailable in strict privacy modes; the demo still works per click.
  }
}

export function getDemoSession(): string | null {
  return readSessionValue(SESSION_KEY);
}

export function setDemoSession(sessionId: string): void {
  writeSessionValue(SESSION_KEY, sessionId);
}

export function clearDemoSession(): void {
  writeSessionValue(SESSION_KEY, null);
}

interface StoredKey {
  key: string;
  createdAt: number;
}

function readStoredKey(value: string | null): StoredKey | null {
  if (value === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'key' in parsed &&
      'createdAt' in parsed &&
      typeof parsed.key === 'string' &&
      typeof parsed.createdAt === 'number'
    ) {
      return { key: parsed.key, createdAt: parsed.createdAt };
    }
  } catch {
    return null;
  }
  return null;
}

export function idempotencyKeyFor(scenarioId: string): string {
  const storageKey = `${IDEMPOTENCY_PREFIX}${scenarioId}`;
  const stored = readStoredKey(readSessionValue(storageKey));
  if (stored !== null && Date.now() - stored.createdAt < IDEMPOTENCY_TTL_MS) {
    return stored.key;
  }
  const key = crypto.randomUUID();
  writeSessionValue(storageKey, JSON.stringify({ key, createdAt: Date.now() }));
  return key;
}

export function clearIdempotencyKey(scenarioId: string): void {
  writeSessionValue(`${IDEMPOTENCY_PREFIX}${scenarioId}`, null);
}

export function useDemoPool() {
  return useQuery({
    queryKey: ['demo', 'pool'],
    queryFn: async (): Promise<PoolPath> => unwrap(apiClient.request<PoolPath>('/api/demo/pool')),
    refetchInterval: 15000,
  });
}

export async function createScenario(scenarioId: string): Promise<ScenarioCreated> {
  const sessionId = getDemoSession();
  const headers = new Headers({
    'Idempotency-Key': idempotencyKeyFor(scenarioId),
  });
  if (sessionId !== null) {
    headers.set('X-Demo-Session', sessionId);
  }
  const created = await unwrap(
    apiClient.request<CreatePath>(`/api/demo/scenarios/${scenarioId}`, {
      method: 'POST',
      headers,
    })
  );
  setDemoSession(created.session_id);
  return created;
}

export async function resetDemo(): Promise<ResetResponse> {
  const sessionId = getDemoSession();
  const headers = new Headers();
  if (sessionId !== null) {
    headers.set('X-Demo-Session', sessionId);
  }
  const reset = await unwrap(
    apiClient.request<ResetPath>('/api/demo/reset', { method: 'POST', headers })
  );
  setDemoSession(reset.session_id);
  return reset;
}

export type WaitResult = 'found' | 'timeout' | 'error' | 'cancelled';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function waitForDispute(
  disputeId: string,
  options: { attempts?: number; intervalMs?: number; isCancelled?: () => boolean } = {}
): Promise<WaitResult> {
  const attempts = options.attempts ?? 20;
  const intervalMs = options.intervalMs ?? 750;
  const isCancelled = options.isCancelled ?? (() => false);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (isCancelled()) {
      return 'cancelled';
    }
    const response = await apiClient.getDispute(disputeId);
    if (response.success) {
      return 'found';
    }
    if (response.error?.kind === 'api_envelope' && response.error.status === 404) {
      await sleep(intervalMs);
      continue;
    }
    return 'error';
  }
  return 'timeout';
}

export function describeDemoError(error: unknown, scenarioId: string): string {
  if (error instanceof ApiQueryError) {
    if (error.status === 429 || error.code === 'QUOTA_EXCEEDED') {
      return `Daily demo quota reached. ${error.message}`;
    }
    if (error.status === 409 || error.code === 'POOL_EMPTY') {
      return `The transaction pool for scenario ${scenarioId} is empty. Reset the demo or choose another scenario.`;
    }
    if (error.status === 503 || error.code === 'FROZEN') {
      return 'The demo is frozen for maintenance. Scenario creation and reset are disabled.';
    }
    return error.message;
  }
  return 'The scenario could not be created.';
}

export interface PooledDispute {
  dispute_id: string;
  state: 'pooled' | 'claimed' | 'done';
  scenario_label: string | null;
  amount: {
    currency_code: string;
    value: string;
  };
  reason: string;
  created_at: string;
  seller_response_due_date: string | null;
  claimed_at: string | null;
}

export function useJudgePool() {
  return useQuery({
    queryKey: ['demo', 'judge-pool'],
    queryFn: async (): Promise<PooledDispute[]> => {
      const data = await unwrap(apiClient.request<unknown>('/api/demo/pool'));
      if (Array.isArray(data)) {
        return data as PooledDispute[];
      }
      return [];
    },
    refetchInterval: 10000,
  });
}

export async function claimJudgeDispute(disputeId: string, demoToken = 'demo-token-active'): Promise<{ dispute_id: string; status: string }> {
  const headers = new Headers({
    'X-Demo-Token': demoToken,
  });
  const res = await apiClient.request<{ dispute_id: string; status: string }>(`/api/demo/claim/${disputeId}`, {
    method: 'POST',
    headers,
  });
  return unwrap(Promise.resolve(res));
}

