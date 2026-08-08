import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Game } from '../../lib/types';

export function useGames() {
  return useQuery<Game[]>({
    queryKey: ['games'],
    queryFn: () => api.get<Game[]>('/games'),
  });
}
