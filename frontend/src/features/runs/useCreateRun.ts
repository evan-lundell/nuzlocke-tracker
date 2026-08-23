import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Run } from '../../lib/types';

export interface CreateRunInput {
  gameId: string;
  name?: string;
  rules?: { ruleId: string; config?: Record<string, unknown> }[];
}

export function useCreateRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRunInput) => api.post<Run>('/runs', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['runs'] });
    },
  });
}
