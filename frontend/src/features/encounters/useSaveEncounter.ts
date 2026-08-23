import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Encounter, EncounterStatus, VitalStatus } from '../../lib/types';

export interface EncounterFormValues {
  speciesId?: string | null;
  status: EncounterStatus;
  nickname?: string | null;
  vitalStatus?: VitalStatus | null;
  lockedType?: string;
}

export function useSaveEncounter(runId: string) {
  const queryClient = useQueryClient();

  // Encounters and party overlap: e.g. marking an encounter DEAD, MISSED,
  // or back to PENDING makes the backend cascade-delete its PartyMembership
  // row (see EncountersService.update), so the party cache must invalidate too.
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
