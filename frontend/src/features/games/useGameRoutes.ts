import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { GameRoute } from '../../lib/types';

export function useGameRoutes(gameId: string) {
  return useQuery<GameRoute[]>({
    queryKey: ['games', gameId, 'routes'],
    queryFn: () => api.get<GameRoute[]>(`/games/${gameId}/routes`),
    enabled: Boolean(gameId),
  });
}
