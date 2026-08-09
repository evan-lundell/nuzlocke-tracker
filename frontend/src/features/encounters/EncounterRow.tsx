import { useState } from 'react';
import { EncounterForm } from './EncounterForm';
import { speciesDisplayName } from '../../lib/encounterDisplay';
import type { Encounter, GameRoute } from '../../lib/types';

interface EncounterRowProps {
  runId: string;
  route: GameRoute;
  encounter?: Encounter;
}

export function EncounterRow({ runId, route, encounter }: EncounterRowProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <li className="py-2">
        <div className="mb-1 text-sm font-medium">{route.name}</div>
        <EncounterForm
          runId={runId}
          route={route}
          existingEncounter={encounter}
          onDone={() => setIsEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 border-b border-neutral-200 py-2 text-sm last:border-0 dark:border-neutral-800">
      <span className="w-40 shrink-0 font-medium">{route.name}</span>
      <span className="flex-1 text-neutral-500">
        {encounter ? summarize(encounter) : 'Not logged'}
      </span>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="shrink-0 rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        {encounter ? 'Edit' : 'Log'}
      </button>
    </li>
  );
}

function summarize(encounter: Encounter): string {
  const parts = [speciesDisplayName(encounter)];
  parts.push(encounter.caught ? 'Caught' : 'Not caught');
  if (encounter.nickname) parts.push(`"${encounter.nickname}"`);
  if (encounter.vitalStatus === 'DEAD') parts.push('Dead');
  return parts.join(' — ');
}
