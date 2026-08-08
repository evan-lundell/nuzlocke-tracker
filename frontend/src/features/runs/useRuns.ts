import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Run } from '../../lib/types';

export function useRuns() {
  return useQuery<Run[]>({
    queryKey: ['runs'],
    queryFn: () => api.get<Run[]>('/runs'),
  });
}
