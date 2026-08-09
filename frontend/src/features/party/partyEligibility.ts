import type { Encounter } from '../../lib/types';

// Mirrors backend/src/party/party-eligibility.ts's isPartyEligible. There's
// no shared-types package between frontend/backend yet (see CLAUDE.md), so
// this is duplicated by necessity — the backend enforces it authoritatively
// either way, this is only for filtering the "Add to party" candidate list.
export function isPartyEligible(encounter: Encounter): boolean {
  return encounter.caught && encounter.vitalStatus !== 'DEAD';
}

export const MAX_PARTY_SIZE = 6;
