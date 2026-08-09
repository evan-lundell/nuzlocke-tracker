import { useParty } from './useParty';
import { usePartyMutations } from './usePartyMutations';
import { useEncounters } from '../encounters/useEncounters';
import type { Encounter } from '../../lib/types';

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
  const eligible = encounters.filter(
    (encounter) =>
      encounter.caught &&
      encounter.vitalStatus !== 'DEAD' &&
      !partyEncounterIds.has(encounter.id),
  );

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {party.length === 0 && (
          <li className="text-sm text-neutral-500">No party members yet.</li>
        )}
        {party.map((member) => (
          <li
            key={member.id}
            className="flex items-center justify-between rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
          >
            {describeEncounter(member.encounter)}
            <button
              type="button"
              onClick={() => removeFromParty.mutate(member.encounterId)}
              disabled={removeFromParty.isPending}
              className="shrink-0 rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Remove
            </button>
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

      {eligible.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-medium text-neutral-500">
            Add to party
          </h3>
          <ul className="flex flex-col gap-2">
            {eligible.map((encounter) => (
              <li
                key={encounter.id}
                className="flex items-center justify-between rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
              >
                {describeEncounter(encounter)}
                <button
                  type="button"
                  onClick={() => addToParty.mutate(encounter.id)}
                  disabled={addToParty.isPending}
                  className="shrink-0 rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function describeEncounter(encounter: Encounter) {
  return (
    <span>
      {encounter.nickname || encounter.species?.name || 'Unknown species'}
      <span className="ml-2 text-neutral-500">({encounter.route.name})</span>
    </span>
  );
}
