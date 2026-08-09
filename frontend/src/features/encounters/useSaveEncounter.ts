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

  // Encounters and party overlap: e.g. marking an encounter DEAD or
  // uncaught makes the backend cascade-delete its PartyMembership row
  // (see EncountersService.update), so the party cache must invalidate too.
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['runs', runId, 'encounters'] }),
      queryClient.invalidateQueries({ queryKey: ['runs', runId, 'party'] }),
    ]);

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
