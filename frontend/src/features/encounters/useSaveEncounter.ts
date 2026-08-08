import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Encounter, VitalStatus } from '../../lib/types';

export interface EncounterFormValues {
  speciesId?: string | null;
  caught: boolean;
  nickname?: string | null;
  vitalStatus?: VitalStatus | null;
}

export function useSaveEncounter(runId: string) {
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['runs', runId, 'encounters'] });

  const create = useMutation({
    mutationFn: (input: EncounterFormValues & { routeId: string }) =>
      api.post<Encounter>(`/runs/${runId}/encounters`, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      encounterId,
      ...input
    }: EncounterFormValues & { encounterId: string }) =>
      api.patch<Encounter>(`/runs/${runId}/encounters/${encounterId}`, input),
    onSuccess: invalidate,
  });

  return { create, update };
}
