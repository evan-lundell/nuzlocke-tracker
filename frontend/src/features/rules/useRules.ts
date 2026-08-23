import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Rule } from '../../lib/types';

// Reference data — the rule catalog is small and rarely changes, so fetch
// it once and cache it indefinitely rather than re-fetching per form.
export function useRules() {
  return useQuery<Rule[]>({
    queryKey: ['rules'],
    queryFn: () => api.get<Rule[]>('/rules'),
    staleTime: Infinity,
  });
}
