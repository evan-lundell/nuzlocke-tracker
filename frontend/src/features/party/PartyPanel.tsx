import { useParty } from './useParty';
import { usePartyMutations } from './usePartyMutations';
import { useEncounters } from '../encounters/useEncounters';
import { useSaveEncounter } from '../encounters/useSaveEncounter';
import { useSpecies } from '../species/useSpecies';
import { isPartyEligible, MAX_PARTY_SIZE } from './partyEligibility';
import { speciesDisplayName } from '../../lib/encounterDisplay';
import type { Encounter, Species } from '../../lib/types';

interface PartyPanelProps {
  runId: string;
}

export function PartyPanel({ runId }: PartyPanelProps) {
  const {
    data: party,
    isPending: partyPending,
    isError: partyIsError,
    error: partyError,
  } = useParty(runId);
  const {
    data: encounters,
    isPending: encountersPending,
    isError: encountersIsError,
    error: encountersError,
  } = useEncounters(runId);
  const { addToParty, removeFromParty } = usePartyMutations(runId);
  const { update: updateEncounter } = useSaveEncounter(runId);
  const { data: allSpecies } = useSpecies();

  if (partyPending || encountersPending) {
    return <p className="text-sm">Loading party…</p>;
  }
  if (partyIsError) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        {partyError.message}
      </p>
    );
  }
  if (encountersIsError) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        {encountersError.message}
      </p>
    );
  }

  const partyEncounterIds = new Set(party.map((member) => member.encounterId));
  const partyIsFull = party.length >= MAX_PARTY_SIZE;
  const eligible = encounters.filter(
    (encounter) =>
      isPartyEligible(encounter) && !partyEncounterIds.has(encounter.id),
  );

  function markDead(encounter: Encounter) {
    updateEncounter.mutate({
      encounterId: encounter.id,
      speciesId: encounter.speciesId,
      status: encounter.status,
      nickname: encounter.nickname,
      vitalStatus: 'DEAD',
    });
  }

  function evolve(encounter: Encounter, newSpeciesId: string) {
    updateEncounter.mutate({
      encounterId: encounter.id,
      speciesId: newSpeciesId,
      status: encounter.status,
      nickname: encounter.nickname,
      vitalStatus: encounter.vitalStatus,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {party.length === 0 && (
          <li className="text-sm text-neutral-500">No party members yet.</li>
        )}
        {party.map((member) => (
          <li
            key={member.id}
            className="flex items-center justify-between gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
          >
            {describeEncounter(member.encounter)}
            <div className="flex shrink-0 items-center gap-2">
              <QuickActions
                encounter={member.encounter}
                allSpecies={allSpecies}
                onMarkDead={markDead}
                onEvolve={evolve}
                isMutating={
                  updateEncounter.isPending &&
                  updateEncounter.variables?.encounterId === member.encounter.id
                }
              />
              <button
                type="button"
                onClick={() => removeFromParty.mutate(member.encounterId)}
                disabled={
                  removeFromParty.isPending &&
                  removeFromParty.variables === member.encounterId
                }
                className="shrink-0 rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      {removeFromParty.isError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {removeFromParty.error.message}
        </p>
      )}
      {addToParty.isError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {addToParty.error.message}
        </p>
      )}
      {updateEncounter.isError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {updateEncounter.error.message}
        </p>
      )}

      {partyIsFull && (
        <p className="text-sm text-neutral-500">
          Party is full ({MAX_PARTY_SIZE}/{MAX_PARTY_SIZE}).
        </p>
      )}

      {!partyIsFull && eligible.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-medium text-neutral-500">
            Add to party
          </h3>
          <ul className="flex flex-col gap-2">
            {eligible.map((encounter) => (
              <li
                key={encounter.id}
                className="flex items-center justify-between gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
              >
                {describeEncounter(encounter)}
                <div className="flex shrink-0 items-center gap-2">
                  <QuickActions
                    encounter={encounter}
                    allSpecies={allSpecies}
                    onMarkDead={markDead}
                    onEvolve={evolve}
                    isMutating={
                      updateEncounter.isPending &&
                      updateEncounter.variables?.encounterId === encounter.id
                    }
                  />
                  <button
                    type="button"
                    onClick={() => addToParty.mutate(encounter.id)}
                    disabled={
                      addToParty.isPending &&
                      addToParty.variables === encounter.id
                    }
                    className="shrink-0 rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    Add
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function describeEncounter(encounter: Encounter) {
  const speciesName = speciesDisplayName(encounter);
  return (
    <span>
      {encounter.nickname ? `${encounter.nickname} (${speciesName})` : speciesName}
      <span className="ml-2 text-neutral-500">({encounter.route.name})</span>
    </span>
  );
}

interface QuickActionsProps {
  encounter: Encounter;
  allSpecies: Species[] | undefined;
  onMarkDead: (encounter: Encounter) => void;
  onEvolve: (encounter: Encounter, newSpeciesId: string) => void;
  isMutating: boolean;
}

function QuickActions({
  encounter,
  allSpecies,
  onMarkDead,
  onEvolve,
  isMutating,
}: QuickActionsProps) {
  const evolutionOptions = encounter.speciesId
    ? (allSpecies ?? []).filter(
        (species) => species.evolvesFromId === encounter.speciesId,
      )
    : [];

  return (
    <>
      {evolutionOptions.length > 0 && (
        <select
          value=""
          disabled={isMutating}
          onChange={(event) => {
            if (event.target.value) onEvolve(encounter, event.target.value);
          }}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="">Evolve…</option>
          {evolutionOptions.map((species) => (
            <option key={species.id} value={species.id}>
              {species.name}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        onClick={() => onMarkDead(encounter)}
        disabled={isMutating}
        className="shrink-0 rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        Mark dead
      </button>
    </>
  );
}
