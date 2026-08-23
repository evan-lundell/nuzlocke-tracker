import { useGameRoutes } from '../games/useGameRoutes';
import { useEncounters } from './useEncounters';
import { EncounterRow } from './EncounterRow';
import type { Encounter } from '../../lib/types';

interface EncounterLogProps {
  runId: string;
  gameId: string;
  typeLocked: boolean;
}

export function EncounterLog({ runId, gameId, typeLocked }: EncounterLogProps) {
  const {
    data: routes,
    isPending: routesPending,
    isError: routesIsError,
    error: routesError,
  } = useGameRoutes(gameId);
  const {
    data: encounters,
    isPending: encountersPending,
    isError: encountersIsError,
    error: encountersError,
  } = useEncounters(runId);

  if (routesPending || encountersPending) {
    return <p className="text-sm">Loading encounters…</p>;
  }
  if (routesIsError) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        {routesError.message}
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

  // A route can have multiple ad hoc encounters (schema allows it, e.g. a
  // static Snorlax logged separately from the wild encounter), but this
  // row-per-route UI only shows one per route. Prefer the default "Wild
  // Encounter" deterministically rather than an arbitrary last-one-wins —
  // showing/editing ad hoc encounters is a future UI addition, not yet built.
  const encounterByRoute = new Map<string, Encounter>();
  for (const encounter of encounters) {
    const current = encounterByRoute.get(encounter.routeId);
    if (!current || (encounter.label === 'Wild Encounter' && current.label !== 'Wild Encounter')) {
      encounterByRoute.set(encounter.routeId, encounter);
    }
  }

  return (
    <ul>
      {routes.map((route) => (
        <EncounterRow
          key={route.id}
          runId={runId}
          route={route}
          encounter={encounterByRoute.get(route.id)}
          typeLocked={typeLocked}
        />
      ))}
    </ul>
  );
}
