import { useQuery } from '@tanstack/react-query';
import type { components, paths } from '@signoff/api-client/generated';
import { apiClient } from '../../app/api';
import { unwrap } from '../../app/queries';
import type { AssistantRequest, AssistantResponse, DisputeItem, Kpis } from './types';

type KpiResponse = components['schemas']['KpiResponse'];
type LlmResponse = paths['/api/llm']['post']['responses']['200']['content']['application/json'];

export function useKpis() {
  return useQuery({
    queryKey: ['kpis'],
    queryFn: async (): Promise<KpiResponse> => unwrap(apiClient.request<KpiResponse>('/api/kpis')),
    refetchInterval: 15000,
  });
}

export function useDashboardDisputes() {
  return useQuery({
    queryKey: ['disputes', 'dashboard'],
    queryFn: async (): Promise<DisputeItem[]> => {
      const response = await unwrap(apiClient.getDisputes({ limit: 50 }));
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
