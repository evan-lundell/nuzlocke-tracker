import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouteSpecies } from '../routes/useRouteSpecies';
import { useSaveEncounter } from './useSaveEncounter';
import type { EncounterFormValues } from './useSaveEncounter';
import type { Encounter, GameRoute, VitalStatus } from '../../lib/types';

interface EncounterFormProps {
  runId: string;
  route: GameRoute;
  existingEncounter?: Encounter;
  onDone: () => void;
}

export function EncounterForm({
  runId,
  route,
  existingEncounter,
  onDone,
}: EncounterFormProps) {
  const {
    data: routeSpecies,
    isPending: speciesPending,
    isError: speciesIsError,
    error: speciesError,
  } = useRouteSpecies(route.id, true);
  const { create, update } = useSaveEncounter(runId);

  const [speciesId, setSpeciesId] = useState(
    existingEncounter?.speciesId ?? '',
  );
  const [caught, setCaught] = useState(existingEncounter?.caught ?? false);
  const [nickname, setNickname] = useState(existingEncounter?.nickname ?? '');
  const [vitalStatus, setVitalStatus] = useState<VitalStatus | ''>(
    existingEncounter?.vitalStatus ?? '',
  );

  const mutation = existingEncounter ? update : create;

  const uniqueSpecies = routeSpecies
    ? [...new Map(routeSpecies.map((entry) => [entry.speciesId, entry.species])).values()]
    : [];

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const values: EncounterFormValues = {
      speciesId: speciesId || undefined,
      caught,
      nickname: nickname.trim() || undefined,
      vitalStatus: caught ? vitalStatus || undefined : undefined,
    };

    if (existingEncounter) {
      update.mutate(
        { encounterId: existingEncounter.id, ...values },
        { onSuccess: onDone },
      );
    } else {
      create.mutate({ routeId: route.id, ...values }, { onSuccess: onDone });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-md border border-neutral-300 p-3 dark:border-neutral-700"
    >
      <label className="flex flex-col gap-1 text-sm">
        Species
        <select
          value={speciesId}
          onChange={(event) => setSpeciesId(event.target.value)}
          disabled={speciesPending}
          className="rounded-md border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="">{speciesPending ? 'Loading…' : 'Unknown'}</option>
          {uniqueSpecies.map((species) => (
            <option key={species.id} value={species.id}>
              {species.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={caught}
          onChange={(event) => setCaught(event.target.checked)}
        />
        Caught
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Nickname
        <input
          type="text"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={50}
          className="rounded-md border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Status
        <select
          value={vitalStatus}
          onChange={(event) =>
            setVitalStatus(event.target.value as VitalStatus | '')
          }
          disabled={!caught}
          className="rounded-md border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="">Alive</option>
          <option value="DEAD">Dead</option>
        </select>
      </label>

      {speciesIsError && (
        <p className="w-full text-sm text-red-600 dark:text-red-400">
          {speciesError.message}
        </p>
      )}
      {mutation.isError && (
        <p className="w-full text-sm text-red-600 dark:text-red-400">
          {mutation.error.message}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
