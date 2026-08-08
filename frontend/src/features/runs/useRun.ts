import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Run } from '../../lib/types';

export function useRun(runId: string) {
  return useQuery<Run>({
    queryKey: ['runs', runId],
    queryFn: () => api.get<Run>(`/runs/${runId}`),
    enabled: Boolean(runId),
  });
}
