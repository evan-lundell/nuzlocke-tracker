import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { RouteSpeciesEntry } from '../../lib/types';

export function useRouteSpecies(routeId: string, enabled: boolean) {
  return useQuery<RouteSpeciesEntry[]>({
    queryKey: ['routes', routeId, 'species'],
    queryFn: () => api.get<RouteSpeciesEntry[]>(`/routes/${routeId}/species`),
    enabled: enabled && Boolean(routeId),
  });
}
