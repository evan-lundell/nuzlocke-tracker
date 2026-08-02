import { PokemonType } from "../../generated/prisma/client";

// Maps PokeAPI's lowercase type slugs to the schema's uppercase enum.
export const POKE_TYPE_MAP: Record<string, PokemonType> = {
  normal: PokemonType.NORMAL,
  fire: PokemonType.FIRE,
  water: PokemonType.WATER,
  electric: PokemonType.ELECTRIC,
  grass: PokemonType.GRASS,
  ice: PokemonType.ICE,
  fighting: PokemonType.FIGHTING,
  poison: PokemonType.POISON,
  ground: PokemonType.GROUND,
  flying: PokemonType.FLYING,
  psychic: PokemonType.PSYCHIC,
  bug: PokemonType.BUG,
  rock: PokemonType.ROCK,
  ghost: PokemonType.GHOST,
  dragon: PokemonType.DRAGON,
  dark: PokemonType.DARK,
  steel: PokemonType.STEEL,
  fairy: PokemonType.FAIRY,
};
