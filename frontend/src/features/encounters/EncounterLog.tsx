import { useGameRoutes } from '../games/useGameRoutes';
import { useEncounters } from './useEncounters';
import { EncounterRow } from './EncounterRow';

interface EncounterLogProps {
  runId: string;
  gameId: string;
}

export function EncounterLog({ runId, gameId }: EncounterLogProps) {
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

  const encounterByRoute = new Map(
    encounters.map((encounter) => [encounter.routeId, encounter]),
  );

  return (
    <ul>
      {routes.map((route) => (
        <EncounterRow
          key={route.id}
          runId={runId}
          route={route}
          encounter={encounterByRoute.get(route.id)}
        />
      ))}
    </ul>
  );
}
