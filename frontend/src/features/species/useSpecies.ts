import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Species } from '../../lib/types';

// Reference data — the full species table (~386 rows) is small and static,
// so fetch it once and cache it indefinitely rather than re-fetching per
// dropdown/search interaction across every route's encounter form.
export function useSpecies() {
  return useQuery<Species[]>({
    queryKey: ['species'],
    queryFn: () => api.get<Species[]>('/species'),
    staleTime: Infinity,
  });
}
