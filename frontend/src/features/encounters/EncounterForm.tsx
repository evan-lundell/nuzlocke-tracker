import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useRouteSpecies } from '../routes/useRouteSpecies';
import { useSpecies } from '../species/useSpecies';
import { useSaveEncounter } from './useSaveEncounter';
import type { EncounterFormValues } from './useSaveEncounter';
import type {
  Encounter,
  EncounterStatus,
  GameRoute,
  Species,
  VitalStatus,
} from '../../lib/types';

const SEARCH_RESULTS_LIMIT = 10;
const UNKNOWN_INDEX = 0;

function comboboxOptionClassName(highlighted: boolean) {
  return `w-full px-2 py-1 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
    highlighted ? 'bg-neutral-100 dark:bg-neutral-800' : ''
  }`;
}

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
  const {
    data: allSpecies,
    isPending: allSpeciesPending,
    isError: allSpeciesIsError,
    error: allSpeciesError,
  } = useSpecies();
  const { create, update } = useSaveEncounter(runId);

  const [selectedSpecies, setSelectedSpecies] = useState<Species | null>(
    existingEncounter?.species ?? null,
  );
  const [speciesQuery, setSpeciesQuery] = useState(
    existingEncounter?.species?.name ?? '',
  );
  const [isSpeciesListOpen, setIsSpeciesListOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [status, setStatus] = useState<EncounterStatus>(
    existingEncounter?.status ?? 'PENDING',
  );
  const [nickname, setNickname] = useState(existingEncounter?.nickname ?? '');
  const [vitalStatus, setVitalStatus] = useState<VitalStatus | ''>(
    existingEncounter?.vitalStatus ?? '',
  );

  const mutation = existingEncounter ? update : create;

  const routeOptions = routeSpecies
    ? [...new Map(routeSpecies.map((entry) => [entry.speciesId, entry.species])).values()]
    : [];
  // The originally-logged species and/or whatever's currently selected may
  // not be one of the route's normally found species (randomizer support,
  // see CLAUDE.md) — keep both selectable in the dropdown so switching away
  // and back doesn't require re-searching, and so it never silently shows
  // "Unknown" for an already-logged catch.
  const dropdownOptions = [...routeOptions];
  for (const species of [existingEncounter?.species, selectedSpecies]) {
    if (species && !dropdownOptions.some((s) => s.id === species.id)) {
      dropdownOptions.push(species);
    }
  }

  const trimmedQuery = speciesQuery.trim().toLowerCase();
  // Typing searches across every species (randomizer support); an empty
  // query falls back to the route's normally-found list.
  const speciesOptions = trimmedQuery
    ? (allSpecies ?? [])
        .filter((species) => species.name.toLowerCase().includes(trimmedQuery))
        .slice(0, SEARCH_RESULTS_LIMIT)
    : dropdownOptions;
  const showUnknownOption = trimmedQuery === '';
  const totalOptionCount = speciesOptions.length + (showUnknownOption ? 1 : 0);

  function selectSpecies(species: Species) {
    setSelectedSpecies(species);
    setSpeciesQuery(species.name);
    setIsSpeciesListOpen(false);
    setHighlightedIndex(-1);
  }

  function clearSpecies() {
    setSelectedSpecies(null);
    setSpeciesQuery('');
    setIsSpeciesListOpen(false);
    setHighlightedIndex(-1);
  }

  // Closing without picking an option reverts the visible text to the
  // committed selection — typing only drives the search list, it never
  // silently changes (or clears) what's actually selected.
  function closeSpeciesList() {
    setIsSpeciesListOpen(false);
    setHighlightedIndex(-1);
    setSpeciesQuery(selectedSpecies?.name ?? '');
  }

  function handleSpeciesKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (totalOptionCount === 0) return;
      setIsSpeciesListOpen(true);
      setHighlightedIndex((index) => (index + 1) % totalOptionCount);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (totalOptionCount === 0) return;
      setIsSpeciesListOpen(true);
      setHighlightedIndex((index) =>
        index <= 0 ? totalOptionCount - 1 : index - 1,
      );
    } else if (event.key === 'Enter') {
      // While the list is closed, Enter should submit the form like any
      // other field. While it's open, Enter means "confirm the highlighted
      // option" instead — with nothing highlighted, it's a no-op.
      if (!isSpeciesListOpen) return;
      event.preventDefault();
      if (highlightedIndex === -1) return;
      if (showUnknownOption && highlightedIndex === UNKNOWN_INDEX) {
        clearSpecies();
        return;
      }
      const species =
        speciesOptions[highlightedIndex - (showUnknownOption ? 1 : 0)];
      if (species) selectSpecies(species);
    } else if (event.key === 'Escape') {
      closeSpeciesList();
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const values: EncounterFormValues = {
      speciesId: selectedSpecies?.id ?? null,
      status,
      nickname: nickname.trim() || null,
      vitalStatus: status === 'CAUGHT' ? vitalStatus || null : null,
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
      <div className="relative flex w-full flex-col gap-1 text-sm sm:w-64">
        <label htmlFor={`species-search-${route.id}`}>Species</label>
        <input
          id={`species-search-${route.id}`}
          type="text"
          role="combobox"
          aria-expanded={isSpeciesListOpen}
          aria-controls={`species-listbox-${route.id}`}
          aria-autocomplete="list"
          autoComplete="off"
          value={speciesQuery}
          disabled={speciesPending}
          onChange={(event) => {
            setSpeciesQuery(event.target.value);
            setIsSpeciesListOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsSpeciesListOpen(true)}
          onBlur={closeSpeciesList}
          onKeyDown={handleSpeciesKeyDown}
          placeholder={speciesPending ? 'Loading…' : 'e.g. Charizard'}
          className="rounded-md border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
        />
        {isSpeciesListOpen && (
          <ul
            id={`species-listbox-${route.id}`}
            role="listbox"
            className="absolute top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-neutral-300 bg-white shadow-md dark:border-neutral-700 dark:bg-neutral-900"
          >
            {showUnknownOption && (
              <li role="option" aria-selected={highlightedIndex === UNKNOWN_INDEX}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={clearSpecies}
                  className={comboboxOptionClassName(
                    highlightedIndex === UNKNOWN_INDEX,
                  )}
                >
                  Unknown
                </button>
              </li>
            )}
            {speciesOptions.map((species, index) => {
              const itemIndex = index + (showUnknownOption ? 1 : 0);
              return (
                <li key={species.id} role="option" aria-selected={highlightedIndex === itemIndex}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectSpecies(species)}
                    className={comboboxOptionClassName(highlightedIndex === itemIndex)}
                  >
                    {species.name}
                  </button>
                </li>
              );
            })}
            {trimmedQuery && allSpeciesPending && (
              <li className="px-2 py-1 text-neutral-500">Loading species…</li>
            )}
            {trimmedQuery && !allSpeciesPending && speciesOptions.length === 0 && (
              <li className="px-2 py-1 text-neutral-500">No matches</li>
            )}
          </ul>
        )}
        {trimmedQuery && allSpeciesIsError && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {allSpeciesError.message}
          </p>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Status
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as EncounterStatus)}
          className="rounded-md border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="PENDING">Pending</option>
          <option value="CAUGHT">Caught</option>
          <option value="MISSED">Missed</option>
        </select>
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
        Health
        <select
          value={vitalStatus}
          onChange={(event) =>
            setVitalStatus(event.target.value as VitalStatus | '')
          }
          disabled={status !== 'CAUGHT'}
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
