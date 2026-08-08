import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import type { User } from '../../lib/types';

export function useCurrentUser() {
  return useQuery<User | null>({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        return await api.get<User>('/auth/me');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }
        throw error;
      }
    },
  });
}
