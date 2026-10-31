/**
 * Pulls games, species, sprites and per-game locations from PokeAPI and writes
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
			const group = await getJson<{ generation: NamedRef }>(
				version.version_group.url,
			);
			return {
				id: version.id,
				slug: version.name,
				name: englishName(version.names, version.name),
				generation: idFromUrl(group.generation.url),
				versionGroup: version.version_group.name,
			};
		},
		"games",
	);
	return games.sort((a, b) => a.id - b.id);
}

async function fetchSpecies() {
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
			}>(s.url);
			return {
				id: data.id,
				slug: data.name,
				name: englishName(data.names, data.name),
				evolvesFromId: data.evolves_from_species
					? idFromUrl(data.evolves_from_species.url)
					: null,
			};
		},
		"species",
	);

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
		.map((s) => ({
			...s,
			types: (typesById.get(s.id) ?? [])
				.sort((a, b) => a.slot - b.slot)
				.map((t) => t.type),
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
