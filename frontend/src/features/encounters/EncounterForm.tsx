import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouteSpecies } from '../routes/useRouteSpecies';
import { useSpecies } from '../species/useSpecies';
import { useSaveEncounter } from './useSaveEncounter';
import type { EncounterFormValues } from './useSaveEncounter';
import type { Encounter, GameRoute, Species, VitalStatus } from '../../lib/types';

const SEARCH_RESULTS_LIMIT = 10;

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
  const { data: allSpecies } = useSpecies();
  const { create, update } = useSaveEncounter(runId);

  const [selectedSpecies, setSelectedSpecies] = useState<Species | null>(
    existingEncounter?.species ?? null,
  );
  const [speciesQuery, setSpeciesQuery] = useState('');
  const [caught, setCaught] = useState(existingEncounter?.caught ?? false);
  const [nickname, setNickname] = useState(existingEncounter?.nickname ?? '');
  const [vitalStatus, setVitalStatus] = useState<VitalStatus | ''>(
    existingEncounter?.vitalStatus ?? '',
  );

  const mutation = existingEncounter ? update : create;

  const routeOptions = routeSpecies
    ? [...new Map(routeSpecies.map((entry) => [entry.speciesId, entry.species])).values()]
    : [];
  // The selected species (from an existing encounter, or picked via search)
  // may not be one of the route's normally found species (randomizer
  // support, see CLAUDE.md) — keep it selectable in the dropdown so it
  // doesn't silently show "Unknown" once chosen.
  const dropdownOptions = [...routeOptions];
  if (
    selectedSpecies &&
    !dropdownOptions.some((species) => species.id === selectedSpecies.id)
  ) {
    dropdownOptions.push(selectedSpecies);
  }

  const trimmedQuery = speciesQuery.trim().toLowerCase();
  const searchResults = trimmedQuery
    ? (allSpecies ?? [])
        .filter((species) => species.name.toLowerCase().includes(trimmedQuery))
        .slice(0, SEARCH_RESULTS_LIMIT)
    : [];

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const values: EncounterFormValues = {
      speciesId: selectedSpecies?.id ?? null,
      caught,
      nickname: nickname.trim() || null,
      vitalStatus: caught ? vitalStatus || null : null,
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
          value={selectedSpecies?.id ?? ''}
          onChange={(event) => {
            const species =
              dropdownOptions.find((s) => s.id === event.target.value) ??
              null;
            setSelectedSpecies(species);
          }}
          disabled={speciesPending}
          className="rounded-md border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="">{speciesPending ? 'Loading…' : 'Unknown'}</option>
          {dropdownOptions.map((species) => (
            <option key={species.id} value={species.id}>
              {species.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex w-full flex-col gap-1 text-sm">
        <label htmlFor={`species-search-${route.id}`}>
          Search all species (randomizer)
        </label>
        <input
          id={`species-search-${route.id}`}
          type="text"
          value={speciesQuery}
          onChange={(event) => setSpeciesQuery(event.target.value)}
          placeholder="e.g. Charizard"
          className="rounded-md border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
        />
        {searchResults.length > 0 && (
          <ul className="flex max-h-32 flex-col overflow-y-auto rounded-md border border-neutral-300 dark:border-neutral-700">
            {searchResults.map((species) => (
              <li key={species.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSpecies(species);
                    setSpeciesQuery('');
                  }}
                  className="w-full px-2 py-1 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  {species.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

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
