/**
 * Pulls games, species (with base stats and evolution methods), sprites and
 * per-game locations from PokeAPI and writes
 * them to data/pokedata/*.json and public/sprites/. Run by hand when the data
 * needs refreshing; the output is committed so the app works offline.
 *
 *   pnpm pokedata:fetch
 *
 * Responses are cached in .cache/pokeapi so reruns are cheap.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EvolutionMethod } from "../src/db/schema";

const API = "https://pokeapi.co/api/v2";
const SPRITE_URL = (id: number) =>
	`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE_DIR = path.join(ROOT, ".cache/pokeapi");
const OUT_DIR = path.join(ROOT, "data/pokedata");
const SPRITE_DIR = path.join(ROOT, "public/sprites");
const CONCURRENCY = 12;

// Versions that aren't nuzlocke-able main-series games
const EXCLUDED_VERSIONS = new Set([
	"colosseum",
	"xd",
	"champions",
	"red-japan",
	"green-japan",
	"blue-japan",
]);

// DLC versions whose locations belong to the base game
const DLC_TO_BASE: Record<string, string> = {
	"the-isle-of-armor-sword": "sword",
	"the-crown-tundra-sword": "sword",
	"the-isle-of-armor-shield": "shield",
	"the-crown-tundra-shield": "shield",
	"the-teal-mask-scarlet": "scarlet",
	"the-indigo-disk-scarlet": "scarlet",
	"the-teal-mask-violet": "violet",
	"the-indigo-disk-violet": "violet",
	"mega-dimension": "legends-za",
};

// DLC version groups, whose evolution methods belong to the base game
const DLC_GROUP_TO_BASE: Record<string, string> = {
	"the-isle-of-armor": "sword-shield",
	"the-crown-tundra": "sword-shield",
	"the-teal-mask": "scarlet-violet",
	"the-indigo-disk": "scarlet-violet",
	"mega-dimension": "legends-za",
};

type NamedRef = { name: string; url: string };
type LocalizedName = { name: string; language: NamedRef };

async function getJson<T>(url: string): Promise<T> {
	const key = createHash("sha1").update(url).digest("hex");
	const file = path.join(CACHE_DIR, `${key}.json`);
	if (existsSync(file)) return JSON.parse(await readFile(file, "utf8"));

	for (let attempt = 1; ; attempt++) {
		const res = await fetch(url);
		if (res.ok) {
			const text = await res.text();
			await writeFile(file, text);
			return JSON.parse(text);
		}
		if (attempt >= 4) throw new Error(`${res.status} fetching ${url}`);
		await new Promise((r) => setTimeout(r, 500 * attempt));
	}
}

async function mapLimit<T, R>(
	items: T[],
	fn: (item: T) => Promise<R>,
	label: string,
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;
	let done = 0;
	await Promise.all(
		Array.from({ length: CONCURRENCY }, async () => {
			while (next < items.length) {
				const i = next++;
				results[i] = await fn(items[i]);
				done++;
				if (done % 100 === 0 || done === items.length) {
					process.stdout.write(`\r  ${label}: ${done}/${items.length}`);
				}
			}
		}),
	);
	process.stdout.write("\n");
	return results;
}

const englishName = (names: LocalizedName[], fallback: string) =>
	names.find((n) => n.language.name === "en")?.name ?? fallback;

const idFromUrl = (url: string) => Number(url.split("/").filter(Boolean).pop());

async function fetchGames() {
	const list = await getJson<{ results: NamedRef[] }>(
		`${API}/version?limit=1000`,
	);
	const versions = list.results.filter(
		(v) => !EXCLUDED_VERSIONS.has(v.name) && !(v.name in DLC_TO_BASE),
	);
	const games = await mapLimit(
		versions,
		async (v) => {
			const version = await getJson<{
				id: number;
				name: string;
				names: LocalizedName[];
				version_group: NamedRef;
			}>(v.url);
			const group = await getJson<{
				generation: NamedRef;
				order: number;
				regions: NamedRef[];
			}>(version.version_group.url);
			return {
				id: version.id,
				slug: version.name,
				name: englishName(version.names, version.name),
				generation: idFromUrl(group.generation.url),
				versionGroup: version.version_group.name,
				versionGroupOrder: group.order,
				regions: group.regions.map((r) => r.name),
			};
		},
		"games",
	);
	return games.sort((a, b) => a.id - b.id);
}

type EvolutionDetail = {
	version_group: NamedRef | null;
	trigger: NamedRef;
	min_level: number | null;
	item: NamedRef | null;
	held_item: NamedRef | null;
	known_move: NamedRef | null;
	known_move_type: NamedRef | null;
	location: NamedRef | null;
	region: NamedRef | null;
	time_of_day: string;
	gender: number | null;
	min_happiness: number | null;
	min_affection: number | null;
	min_beauty: number | null;
	relative_physical_stats: number | null;
	party_species: NamedRef | null;
	party_type: NamedRef | null;
	trade_species: NamedRef | null;
	needs_overworld_rain: boolean;
	turn_upside_down: boolean;
	used_move: NamedRef | null;
	min_move_count: number | null;
	min_steps: number | null;
	min_damage_taken: number | null;
};

type ChainLink = {
	species: NamedRef;
	evolution_details: EvolutionDetail[];
	evolves_to: ChainLink[];
};

const STAT_KEYS: Record<string, string> = {
	hp: "hp",
	attack: "attack",
	defense: "defense",
	"special-attack": "specialAttack",
	"special-defense": "specialDefense",
	speed: "speed",
};

type GroupInfo = { order: number; generation: number; name: string };

async function toMethod(
	d: EvolutionDetail,
	groups: Map<string, GroupInfo>,
): Promise<EvolutionMethod> {
	const name = d.version_group?.name;
	const vg = name ? (DLC_GROUP_TO_BASE[name] ?? name) : null;
	const group = vg ? groups.get(vg) : undefined;
	const m: EvolutionMethod = {
		versionGroup: vg,
		versionGroupName: group?.name ?? null,
		versionGroupOrder: group?.order ?? 0,
		generation: group?.generation ?? null,
		trigger: d.trigger.name,
	};
	// Only keep the conditions that apply, so the JSON stays small
	const set = <K extends keyof EvolutionMethod>(
		key: K,
		value: EvolutionMethod[K] | null | undefined | false | "",
	) => {
		if (
			value !== null &&
			value !== undefined &&
			value !== false &&
			value !== ""
		)
			m[key] = value as EvolutionMethod[K];
	};
	set("minLevel", d.min_level);
	set("item", d.item?.name);
	set("heldItem", d.held_item?.name);
	set("knownMove", d.known_move?.name);
	set("knownMoveType", d.known_move_type?.name);
	set("location", d.location?.name);
	if (d.location) {
		const loc = await getJson<{ region: NamedRef | null }>(d.location.url);
		set("locationRegion", loc.region?.name);
	}
	set("region", d.region?.name);
	set("timeOfDay", d.time_of_day);
	set("gender", d.gender === 1 ? "female" : d.gender === 2 ? "male" : null);
	set("minHappiness", d.min_happiness);
	set("minAffection", d.min_affection);
	set("minBeauty", d.min_beauty);
	set("relativePhysicalStats", d.relative_physical_stats);
	set("partySpecies", d.party_species?.name);
	set("partyType", d.party_type?.name);
	set("tradeSpecies", d.trade_species?.name);
	set("needsOverworldRain", d.needs_overworld_rain);
	set("turnUpsideDown", d.turn_upside_down);
	set("usedMove", d.used_move?.name);
	set("minMoveCount", d.min_move_count);
	set("minSteps", d.min_steps);
	set("minDamageTaken", d.min_damage_taken);
	return m;
}

async function fetchSpecies() {
	const groups = await getJson<{ results: NamedRef[] }>(
		`${API}/version-group?limit=100`,
	);
	const groupInfo = new Map<string, GroupInfo>();
	await mapLimit(
		groups.results,
		async (g) => {
			const group = await getJson<{
				order: number;
				generation: NamedRef;
				versions: NamedRef[];
			}>(g.url);
			// "Sun/Moon", for labelling methods borrowed from another game
			const versions = await Promise.all(
				group.versions.map(async (v) => {
					const version = await getJson<{ names: LocalizedName[] }>(v.url);
					return englishName(version.names, v.name);
				}),
			);
			groupInfo.set(g.name, {
				order: group.order,
				generation: idFromUrl(group.generation.url),
				name: versions.join("/"),
			});
		},
		"version groups",
	);

	const list = await getJson<{ results: NamedRef[] }>(
		`${API}/pokemon-species?limit=2000`,
	);
	const species = await mapLimit(
		list.results,
		async (s) => {
			const data = await getJson<{
				id: number;
				name: string;
				names: LocalizedName[];
				evolves_from_species: NamedRef | null;
				evolution_chain: { url: string } | null;
				varieties: { is_default: boolean; pokemon: NamedRef }[];
			}>(s.url);
			const variety =
				data.varieties.find((v) => v.is_default) ?? data.varieties[0];
			const pokemon = await getJson<{
				stats: { base_stat: number; stat: NamedRef }[];
			}>(variety.pokemon.url);
			const stats = Object.fromEntries(
				pokemon.stats.flatMap((st) =>
					st.stat.name in STAT_KEYS
						? [[STAT_KEYS[st.stat.name], st.base_stat]]
						: [],
				),
			) as Record<
				| "hp"
				| "attack"
				| "defense"
				| "specialAttack"
				| "specialDefense"
				| "speed",
				number
			>;
			return {
				id: data.id,
				slug: data.name,
				name: englishName(data.names, data.name),
				evolvesFromId: data.evolves_from_species
					? idFromUrl(data.evolves_from_species.url)
					: null,
				chainUrl: data.evolution_chain?.url ?? null,
				...stats,
			};
		},
		"species",
	);

	// Evolution methods live on the chains, keyed to the species they lead to
	const chainUrls = [
		...new Set(species.flatMap((s) => (s.chainUrl ? [s.chainUrl] : []))),
	];
	const methodsById = new Map<number, EvolutionMethod[]>();
	const chains = await mapLimit(
		chainUrls,
		(url) => getJson<{ chain: ChainLink }>(url),
		"evolution chains",
	);
	const walk = async (link: ChainLink) => {
		const methods = await Promise.all(
			link.evolution_details.map((d) => toMethod(d, groupInfo)),
		);
		// PokeAPI repeats a method once per evolved form (Alcremie has 63)
		const unique = [
			...new Map(methods.map((m) => [JSON.stringify(m), m])).values(),
		];
		methodsById.set(idFromUrl(link.species.url), unique);
		for (const next of link.evolves_to) await walk(next);
	};
	for (const c of chains) await walk(c.chain);

	// Types come from the 18 /type endpoints rather than 1000+ /pokemon calls.
	// Default forms share the species' id, so anything above maxId is an alt form.
	const maxId = Math.max(...species.map((s) => s.id));
	const typeList = await getJson<{ results: NamedRef[] }>(`${API}/type`);
	const typesById = new Map<number, { slot: number; type: string }[]>();
	for (const t of typeList.results) {
		const type = await getJson<{
			name: string;
			pokemon: { slot: number; pokemon: NamedRef }[];
		}>(t.url);
		for (const p of type.pokemon) {
			const id = idFromUrl(p.pokemon.url);
			if (id > maxId) continue;
			const entry = typesById.get(id) ?? [];
			entry.push({ slot: p.slot, type: type.name });
			typesById.set(id, entry);
		}
	}

	return species
		.map(({ chainUrl: _, ...s }) => ({
			...s,
			types: (typesById.get(s.id) ?? [])
				.sort((a, b) => a.slot - b.slot)
				.map((t) => t.type),
			evolutionMethods: s.evolvesFromId ? (methodsById.get(s.id) ?? []) : [],
		}))
		.sort((a, b) => a.id - b.id);
}

async function fetchLocations(gameSlugs: Set<string>) {
	const list = await getJson<{ results: NamedRef[] }>(
		`${API}/location-area?limit=5000`,
	);
	const areas = await mapLimit(
		list.results,
		(a) =>
			getJson<{
				location: NamedRef;
				pokemon_encounters: {
					version_details: { version: NamedRef }[];
				}[];
			}>(a.url),
		"location areas",
	);

	// location slug -> set of game slugs it has encounters in
	const gamesByLocation = new Map<
		string,
		{ url: string; games: Set<string> }
	>();
	for (const area of areas) {
		const entry = gamesByLocation.get(area.location.name) ?? {
			url: area.location.url,
			games: new Set<string>(),
		};
		for (const enc of area.pokemon_encounters) {
			for (const vd of enc.version_details) {
				const slug = DLC_TO_BASE[vd.version.name] ?? vd.version.name;
				if (gameSlugs.has(slug)) entry.games.add(slug);
			}
		}
		gamesByLocation.set(area.location.name, entry);
	}

	const withGames = [...gamesByLocation.entries()].filter(
		([, v]) => v.games.size > 0,
	);
	const locations = await mapLimit(
		withGames,
		async ([slug, { url, games }]) => {
			const data = await getJson<{ names: LocalizedName[] }>(url);
			return {
				slug,
				name: englishName(data.names, slug),
				games: [...games].sort(),
			};
		},
		"locations",
	);
	return locations.sort((a, b) => a.slug.localeCompare(b.slug));
}

async function downloadSprites(ids: number[]) {
	let missing = 0;
	await mapLimit(
		ids,
		async (id) => {
			const file = path.join(SPRITE_DIR, `${id}.png`);
			if (existsSync(file)) return;
			const res = await fetch(SPRITE_URL(id));
			if (!res.ok) {
				missing++;
				return;
			}
			await writeFile(file, Buffer.from(await res.arrayBuffer()));
		},
		"sprites",
	);
	if (missing) console.warn(`  ${missing} sprites not found`);
}

async function writeOut(name: string, data: unknown) {
	await writeFile(
		path.join(OUT_DIR, `${name}.json`),
		`${JSON.stringify(data, null, "\t")}\n`,
	);
}

async function main() {
	await mkdir(CACHE_DIR, { recursive: true });
	await mkdir(OUT_DIR, { recursive: true });
	await mkdir(SPRITE_DIR, { recursive: true });

	console.log("Fetching games…");
	const games = await fetchGames();
	await writeOut("games", games);

	console.log("Fetching species…");
	const species = await fetchSpecies();
	await writeOut("species", species);

	console.log("Fetching locations…");
	const locations = await fetchLocations(new Set(games.map((g) => g.slug)));
	await writeOut("locations", locations);

	console.log("Downloading sprites…");
	await downloadSprites(species.map((s) => s.id));

	console.log(
		`Done: ${games.length} games, ${species.length} species, ${locations.length} locations`,
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
