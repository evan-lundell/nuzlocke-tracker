import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { PartyMembership } from '../../lib/types';

export function usePartyMutations(runId: string) {
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['runs', runId, 'party'] });

  const addToParty = useMutation({
    mutationFn: (encounterId: string) =>
      api.post<PartyMembership>(`/runs/${runId}/party`, { encounterId }),
    onSuccess: invalidate,
  });

  const removeFromParty = useMutation({
    mutationFn: (encounterId: string) =>
      api.delete<void>(`/runs/${runId}/party/${encounterId}`),
    onSuccess: invalidate,
  });

  return { addToParty, removeFromParty };
}
