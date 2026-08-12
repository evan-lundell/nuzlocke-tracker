import { Encounter } from '../../generated/prisma/client';

export function isPartyEligible(
  encounter: Pick<Encounter, 'status' | 'vitalStatus'>,
): boolean {
  return encounter.status === 'CAUGHT' && encounter.vitalStatus !== 'DEAD';
}
