import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../app/api';
import { unwrap } from '../../app/queries';
import type { Charter, CharterUpdate } from './types';

export function useCharter() {
  return useQuery({
    queryKey: ['charter'],
    queryFn: async (): Promise<Charter> => unwrap(apiClient.getCharter()),
  });
}

export function useCharterHistory() {
  return useQuery({
    queryKey: ['charter', 'history'],
    queryFn: async (): Promise<Charter[]> =>
      unwrap(apiClient.request<Charter[]>('/api/charter/history', { method: 'GET' })),
  });
}

export async function fetchLatestCharter(): Promise<Charter> {
  return unwrap(apiClient.getCharter());
}

export function useUpdateCharter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CharterUpdate): Promise<Charter> =>
      unwrap(apiClient.updateCharter(body)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['charter'] }),
        queryClient.invalidateQueries({ queryKey: ['charter', 'history'] }),
      ]);
    },
  });
}
