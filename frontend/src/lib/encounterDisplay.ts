import type { Encounter } from './types';

export function speciesDisplayName(encounter: Encounter): string {
  return encounter.species?.name ?? 'Unknown species';
}
