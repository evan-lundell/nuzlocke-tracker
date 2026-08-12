// One-time reference-data import from PokeAPI (pokeapi.co) for LeafGreen.
// Safe to re-run: every write is an upsert keyed on the schema's existing
// unique constraints.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { LEAFGREEN_ROUTE_ORDER } from "./seed-data/leafgreen-route-order";
import { POKE_TYPE_MAP } from "./seed-data/poke-type-map";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
const prisma = new PrismaClient({ adapter });

const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const GAME_IDENTIFIER = "leafgreen";
const GAME_NAME = "LeafGreen";
const FIRST_GEN_SPECIES_ID = 1;
const LAST_GEN_SPECIES_ID = 386; // Deoxys — end of Generation III
const CONCURRENCY = 8;

async function fetchJson<T>(url: string): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      headers: { "User-Agent": "nuzlocke-tracker-seed-script/1.0" },
    });
    if (res.ok) return (await res.json()) as T;
    if (attempt === 3) {
      throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
    }
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
  throw new Error(`unreachable: ${url}`);
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

interface NamedApiResource {
  name: string;
  url: string;
}

interface PokeApiName {
  name: string;
  language: NamedApiResource;
}

interface PokeApiVersionGroup {
  generation: NamedApiResource;
}

interface PokeApiSpecies {
  id: number;
  name: string;
  names: PokeApiName[];
  varieties: { is_default: boolean; pokemon: NamedApiResource }[];
  evolution_chain: { url: string };
}

interface PokeApiPokemon {
  types: { slot: number; type: NamedApiResource }[];
}

interface EvolutionDetail {
  trigger: NamedApiResource;
  version_group: NamedApiResource;
  min_level: number | null;
  min_happiness: number | null;
  min_beauty: number | null;
  held_item: NamedApiResource | null;
  item: NamedApiResource | null;
  time_of_day: string;
  known_move: NamedApiResource | null;
  location: NamedApiResource | null;
}

interface EvolutionChainNode {
  species: NamedApiResource;
  evolution_details: EvolutionDetail[];
  evolves_to: EvolutionChainNode[];
}

interface EvolutionChain {
  chain: EvolutionChainNode;
}

interface PokeApiRegion {
  locations: NamedApiResource[];
}

interface PokeApiLocation {
  name: string;
  names: PokeApiName[];
  areas: NamedApiResource[];
}

interface EncounterDetail {
  method: NamedApiResource;
}

interface VersionDetail {
  version: NamedApiResource;
  encounter_details: EncounterDetail[];
}

interface PokemonEncounter {
  pokemon: NamedApiResource;
  version_details: VersionDetail[];
}

interface PokeApiLocationArea {
  name: string;
  pokemon_encounters: PokemonEncounter[];
}

function englishName(names: PokeApiName[], fallbackSlug: string): string {
  const en = names.find((n) => n.language.name === "en");
  if (en) return en.name;
  return fallbackSlug
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function evolutionDetailText(detail: EvolutionDetail): string | null {
  const parts: string[] = [];
  if (detail.min_level != null) parts.push(`level ${detail.min_level}`);
  if (detail.min_happiness != null) parts.push(`friendship ${detail.min_happiness}+`);
  if (detail.min_beauty != null) parts.push(`beauty ${detail.min_beauty}+`);
  if (detail.item) parts.push(`use ${detail.item.name}`);
  if (detail.held_item) parts.push(`holding ${detail.held_item.name}`);
  if (detail.time_of_day) parts.push(detail.time_of_day);
  if (detail.known_move) parts.push(`knows ${detail.known_move.name}`);
  if (detail.location) parts.push(`at ${detail.location.name}`);
  return parts.length > 0 ? parts.join(", ") : null;
}

function pickEvolutionDetail(details: EvolutionDetail[]): EvolutionDetail {
  return details.find((d) => d.version_group.name === "firered-leafgreen") ?? details[0];
}

async function seedSpecies() {
  console.log(`Fetching ${LAST_GEN_SPECIES_ID} species (Gen 1-3)...`);

  const speciesIds = Array.from(
    { length: LAST_GEN_SPECIES_ID - FIRST_GEN_SPECIES_ID + 1 },
    (_, i) => FIRST_GEN_SPECIES_ID + i,
  );

  const pokemonNameToSpeciesIdentifier = new Map<string, string>();
  const evolutionChainUrlBySpeciesIdentifier = new Map<string, string>();

  const collected = await mapPool(speciesIds, CONCURRENCY, async (id) => {
    const species = await fetchJson<PokeApiSpecies>(`${POKEAPI_BASE}/pokemon-species/${id}`);
    for (const v of species.varieties) {
      pokemonNameToSpeciesIdentifier.set(v.pokemon.name, species.name);
    }
    evolutionChainUrlBySpeciesIdentifier.set(species.name, species.evolution_chain.url);

    const defaultVariety = species.varieties.find((v) => v.is_default) ?? species.varieties[0];
    const pokemon = await fetchJson<PokeApiPokemon>(defaultVariety.pokemon.url);
    const typeSlot1 = pokemon.types.find((t) => t.slot === 1);
    const typeSlot2 = pokemon.types.find((t) => t.slot === 2);
    if (!typeSlot1) throw new Error(`species ${species.name} has no primary type`);

    return {
      identifier: species.name,
      name: englishName(species.names, species.name),
      pokedexNumber: species.id,
      typePrimary: POKE_TYPE_MAP[typeSlot1.type.name],
      typeSecondary: typeSlot2 ? POKE_TYPE_MAP[typeSlot2.type.name] : null,
    };
  });

  console.log("Upserting species (pass 1: without evolution links)...");
  for (const s of collected) {
    await prisma.species.upsert({
      where: { identifier: s.identifier },
      create: s,
      update: s,
    });
  }

  console.log("Fetching evolution chains...");
  const uniqueChainUrls = [...new Set(evolutionChainUrlBySpeciesIdentifier.values())];
  const knownSpeciesIdentifiers = new Set(collected.map((s) => s.identifier));
  const evolutionInfo = new Map<
    string,
    { evolvesFromIdentifier: string; method: string; detail: string | null }
  >();

  await mapPool(uniqueChainUrls, CONCURRENCY, async (url) => {
    const { chain } = await fetchJson<EvolutionChain>(url);

    // Some Gen 1-3 species have later-gen (4+) baby forms or further evolutions
    // spliced into their PokeAPI evolution chain (e.g. Mime Jr. -> Mr. Mime ->
    // Mr. Rime, Budew -> Roselia -> Roserade). Those are out of our Gen 1-3
    // scope and don't exist as Species rows, so skip any link touching them.
    function walk(node: EvolutionChainNode, parentIdentifier: string | null) {
      if (
        parentIdentifier &&
        knownSpeciesIdentifiers.has(node.species.name) &&
        knownSpeciesIdentifiers.has(parentIdentifier) &&
        node.evolution_details.length > 0
      ) {
        const detail = pickEvolutionDetail(node.evolution_details);
        evolutionInfo.set(node.species.name, {
          evolvesFromIdentifier: parentIdentifier,
          method: detail.trigger.name,
          detail: evolutionDetailText(detail),
        });
      }
      for (const child of node.evolves_to) walk(child, node.species.name);
    }
    walk(chain, null);
  });

  console.log("Updating species (pass 2: evolution links)...");
  for (const [identifier, info] of evolutionInfo) {
    await prisma.species.update({
      where: { identifier },
      data: {
        evolvesFrom: { connect: { identifier: info.evolvesFromIdentifier } },
        evolutionMethod: info.method,
        evolutionDetail: info.detail,
      },
    });
  }

  console.log(`Seeded ${collected.length} species.`);
  return { pokemonNameToSpeciesIdentifier };
}

async function seedRoutesAndEncounters(gameId: string, pokemonNameToSpeciesIdentifier: Map<string, string>) {
  console.log("Fetching Kanto region locations...");
  const region = await fetchJson<PokeApiRegion>(`${POKEAPI_BASE}/region/kanto`);

  const locations = await mapPool(region.locations, CONCURRENCY, (loc) =>
    fetchJson<PokeApiLocation>(loc.url),
  );

  // Route granularity is per-location, not per-location-area: the game shows
  // one banner name per location regardless of floor/sub-area (nuzlocke
  // convention keys off that banner, e.g. Mt. Moon's 3 floors are one
  // encounter, not three). So a location's areas are combined into a single
  // candidate route, with encounters pooled across all of them.
  interface CandidateRoute {
    identifier: string;
    name: string;
    encounters: PokemonEncounter[];
  }

  const candidateRoutes: CandidateRoute[] = [];

  await mapPool(locations, CONCURRENCY, async (loc) => {
    const areaDetails = await mapPool(loc.areas, CONCURRENCY, (area) =>
      fetchJson<PokeApiLocationArea>(area.url),
    );
    const leafgreenEncounters = areaDetails
      .flatMap((detail) => detail.pokemon_encounters)
      .filter((pe) => pe.version_details.some((vd) => vd.version.name === GAME_IDENTIFIER));
    if (leafgreenEncounters.length === 0) return;

    candidateRoutes.push({
      identifier: loc.name,
      name: englishName(loc.names, loc.name),
      encounters: leafgreenEncounters,
    });
  });

  console.log(`Found ${candidateRoutes.length} locations with leafgreen encounters.`);

  const orderIndex = new Map(LEAFGREEN_ROUTE_ORDER.map((identifier, i) => [identifier, i]));
  for (const route of candidateRoutes) {
    if (!orderIndex.has(route.identifier)) {
      console.warn(`WARNING: ${route.identifier} not in LEAFGREEN_ROUTE_ORDER, sorting last`);
    }
  }

  console.log("Upserting routes...");
  const routeIdByIdentifier = new Map<string, string>();
  for (const candidate of candidateRoutes) {
    const order = orderIndex.get(candidate.identifier) ?? LEAFGREEN_ROUTE_ORDER.length + 1;
    const route = await prisma.route.upsert({
      where: { gameId_identifier: { gameId, identifier: candidate.identifier } },
      create: { gameId, identifier: candidate.identifier, name: candidate.name, order },
      update: { name: candidate.name, order },
    });
    routeIdByIdentifier.set(candidate.identifier, route.id);
  }

  console.log("Upserting route species (encounters)...");
  let routeSpeciesCount = 0;
  for (const candidate of candidateRoutes) {
    const routeId = routeIdByIdentifier.get(candidate.identifier)!;
    const methodsBySpecies = new Map<string, Set<string>>();

    for (const encounter of candidate.encounters) {
      const speciesIdentifier = pokemonNameToSpeciesIdentifier.get(encounter.pokemon.name);
      if (!speciesIdentifier) {
        console.warn(`WARNING: no species mapped for pokemon "${encounter.pokemon.name}" in ${candidate.identifier}`);
        continue;
      }
      const methods = methodsBySpecies.get(speciesIdentifier) ?? new Set<string>();
      for (const vd of encounter.version_details) {
        if (vd.version.name !== GAME_IDENTIFIER) continue;
        for (const ed of vd.encounter_details) methods.add(ed.method.name);
      }
      methodsBySpecies.set(speciesIdentifier, methods);
    }

    for (const [speciesIdentifier, methods] of methodsBySpecies) {
      const species = await prisma.species.findUniqueOrThrow({ where: { identifier: speciesIdentifier } });
      for (const method of methods) {
        await prisma.routeSpecies.upsert({
          where: { routeId_speciesId_method: { routeId, speciesId: species.id, method } },
          create: { routeId, speciesId: species.id, method },
          update: {},
        });
        routeSpeciesCount++;
      }
    }
  }

  console.log(`Seeded ${candidateRoutes.length} routes and ${routeSpeciesCount} route-species rows.`);
}

async function seedRules() {
  await prisma.rule.upsert({
    where: { key: "type-lock" },
    create: {
      key: "type-lock",
      name: "Type-lock",
      description:
        "The active party cannot contain duplicate types. For dual-typed Pokémon, the player chooses one of its two types at the moment of catching, and the Pokémon is permanently locked to that single type from then on.",
      kind: "ENFORCED",
    },
    update: {
      name: "Type-lock",
      description:
        "The active party cannot contain duplicate types. For dual-typed Pokémon, the player chooses one of its two types at the moment of catching, and the Pokémon is permanently locked to that single type from then on.",
      kind: "ENFORCED",
    },
  });
  console.log("Seeded rules.");
}

async function main() {
  await seedRules();

  console.log(`Upserting Game "${GAME_NAME}"...`);
  const versionGroup = await fetchJson<PokeApiVersionGroup>(`${POKEAPI_BASE}/version-group/firered-leafgreen`);
  const generationMatch = /\/generation\/(\d+)\/?$/.exec(versionGroup.generation.url);
  if (!generationMatch) throw new Error("could not parse generation number");
  const generation = Number(generationMatch[1]);

  const game = await prisma.game.upsert({
    where: { identifier: GAME_IDENTIFIER },
    create: { identifier: GAME_IDENTIFIER, name: GAME_NAME, generation },
    update: { name: GAME_NAME, generation },
  });

  const { pokemonNameToSpeciesIdentifier } = await seedSpecies();
  await seedRoutesAndEncounters(game.id, pokemonNameToSpeciesIdentifier);

  const [gameCount, speciesCount, routeCount, routeSpeciesCount] = await Promise.all([
    prisma.game.count(),
    prisma.species.count(),
    prisma.route.count(),
    prisma.routeSpecies.count(),
  ]);
  console.log("Done.", { gameCount, speciesCount, routeCount, routeSpeciesCount });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
