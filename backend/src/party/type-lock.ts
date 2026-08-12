import { PokemonType } from '../../generated/prisma/client';

export const TYPE_LOCK_RULE_KEY = 'type-lock';

// The type-lock rule's effective type for a party member: the chosen
// lockedType if one's been set, or the species' single type if it isn't
// dual-typed. Returns null for a dual-typed species with no lockedType
// chosen yet — the caller decides that's not allowed into the party.
export function effectiveType(
  encounter: { lockedType: PokemonType | null },
  species: { typePrimary: PokemonType; typeSecondary: PokemonType | null },
): PokemonType | null {
  if (encounter.lockedType) return encounter.lockedType;
  if (species.typeSecondary) return null;
  return species.typePrimary;
}

type PartyMemberWithSpecies = {
  encounter: {
    lockedType: PokemonType | null;
    species: {
      typePrimary: PokemonType;
      typeSecondary: PokemonType | null;
    } | null;
  };
};

// Whether any current party member already has the given effective type —
// shared by PartyService (adding a new member) and EncountersService
// (evolving a species already in the party) so the two clash checks can't
// drift apart.
export function hasTypeClash(
  candidateType: PokemonType,
  partyMembers: PartyMemberWithSpecies[],
): boolean {
  return partyMembers.some(
    (member) =>
      member.encounter.species &&
      effectiveType(member.encounter, member.encounter.species) ===
        candidateType,
  );
}
