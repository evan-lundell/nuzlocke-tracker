import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { PartyMembership } from '../../lib/types';

export function useParty(runId: string) {
  return useQuery<PartyMembership[]>({
    queryKey: ['runs', runId, 'party'],
    queryFn: () => api.get<PartyMembership[]>(`/runs/${runId}/party`),
    enabled: Boolean(runId),
  });
}
