import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Encounter } from '../../lib/types';

export function useEncounters(runId: string) {
  return useQuery<Encounter[]>({
    queryKey: ['runs', runId, 'encounters'],
    queryFn: () => api.get<Encounter[]>(`/runs/${runId}/encounters`),
    enabled: Boolean(runId),
  });
}
