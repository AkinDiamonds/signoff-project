import { useQuery } from '@tanstack/react-query';
import type { components, paths } from '@signoff/api-client/generated';
import { apiClient } from '../../app/api';
import { unwrap } from '../../app/queries';
import type { AssistantRequest, AssistantResponse, DisputeItem, Kpis } from './types';

type KpiResponse = components['schemas']['KpiResponse'];
type LlmResponse = paths['/api/llm']['post']['responses']['200']['content']['application/json'];

export type KpiScope = 'mine' | 'all';

export function useKpis(scope: KpiScope = 'all', demoSession: string | null = null) {
  return useQuery({
    queryKey: ['kpis', scope, scope === 'mine' ? demoSession : null],
    queryFn: async (): Promise<KpiResponse> => unwrap(apiClient.request<KpiResponse>('/api/kpis', {
      params: { query: { scope } },
      ...(scope === 'mine' && demoSession ? { headers: { 'X-Demo-Session': demoSession } } : {}),
    })),
    refetchInterval: 15000,
  });
}

export function useDashboardDisputes(scope: KpiScope = 'all', demoSession: string | null = null) {
  return useQuery({
    queryKey: scope === 'mine' ? ['disputes', 'dashboard', 'mine', demoSession] : ['disputes', 'dashboard'],
    queryFn: async (): Promise<DisputeItem[]> => {
      const response = scope === 'mine'
        ? await unwrap(apiClient.getDisputes({ limit: 50, scope }, demoSession))
        : await unwrap(apiClient.getDisputes({ limit: 50 }));
      return response.items;
    },
    refetchInterval: 15000,
  });
}

export async function askAssistant(request: AssistantRequest): Promise<AssistantResponse> {
  const response = await unwrap<LlmResponse>(
    apiClient.request<LlmResponse>('/api/llm', {
      method: 'POST',
      body: request,
      timeoutMs: 30000,
    })
  );
  return response;
}

export type DashboardKpis = Kpis;
