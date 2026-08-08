import { Encounter } from '../../generated/prisma/client';

export function isPartyEligible(
  encounter: Pick<Encounter, 'caught' | 'vitalStatus'>,
): boolean {
  return encounter.caught && encounter.vitalStatus !== 'DEAD';
}
