import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "./client.server";
import { games, locations, species } from "./schema";

type GameJson = typeof games.$inferSelect;
type SpeciesJson = typeof species.$inferSelect;
type LocationJson = { slug: string; name: string; games: string[] };

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8"));

const kebab = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

/**
 * Upserts bundled reference data. Safe to run on every startup: seeded
 * locations keep their ids (matched on game + slug) so encounters stay linked,
 * and nothing is ever deleted.
 */
export function seedRefdata(db: Db, dataDir: string) {
	const gameRows = readJson<GameJson[]>(path.join(dataDir, "games.json"));
	const speciesRows = readJson<SpeciesJson[]>(
		path.join(dataDir, "species.json"),
	);
	const locationRows = readJson<LocationJson[]>(
		path.join(dataDir, "locations.json"),
	);

	db.transaction((tx) => {
		for (const g of gameRows) {
			tx.insert(games)
				.values(g)
				.onConflictDoUpdate({ target: games.id, set: g })
				.run();
		}

		for (const s of speciesRows) {
			tx.insert(species)
				.values(s)
				.onConflictDoUpdate({ target: species.id, set: s })
				.run();
		}

		const gameIdBySlug = new Map(gameRows.map((g) => [g.slug, g.id]));
		for (const loc of locationRows) {
			for (const gameSlug of loc.games) {
				const gameId = gameIdBySlug.get(gameSlug);
				if (gameId === undefined) continue;
				tx.insert(locations)
					.values({ gameId, slug: loc.slug, name: loc.name })
					.onConflictDoUpdate({
						target: [locations.gameId, locations.slug],
						set: { name: loc.name },
					})
					.run();
			}
		}

		applyRouteOrders(tx, path.join(dataDir, "route-order"), gameIdBySlug);
	});
}

/**
 * Applies data/pokedata/route-order/{gameSlug}.json files: an array of
 * location names (or slugs) in play order. Listed locations get sortOrder =
 * their index; unlisted seeded locations reset to null (alphabetical fallback).
 * Names that don't match an existing location are added as seeded locations,
 * which is how games without PokeAPI location data get a route list.
 */
function applyRouteOrders(
	tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
	dir: string,
	gameIdBySlug: Map<string, number>,
) {
	tx.update(locations)
		.set({ sortOrder: null })
		.where(isNull(locations.runId))
		.run();

	if (!existsSync(dir)) return;

	for (const file of readdirSync(dir)) {
		if (!file.endsWith(".json")) continue;
		const gameSlug = file.slice(0, -".json".length);
		const gameId = gameIdBySlug.get(gameSlug);
		if (gameId === undefined) {
			console.warn(`[seed] route-order/${file}: unknown game "${gameSlug}"`);
			continue;
		}

		const order = readJson<string[]>(path.join(dir, file));
		const existing = tx
			.select({
				id: locations.id,
				slug: locations.slug,
				name: locations.name,
			})
			.from(locations)
			.where(and(eq(locations.gameId, gameId), isNull(locations.runId)))
			.all();

		order.forEach((entry, sortOrder) => {
			const key = entry.trim().toLowerCase();
			const match = existing.find(
				(l) => l.slug === key || l.name.toLowerCase() === key,
			);
			if (match) {
				tx.update(locations)
					.set({ sortOrder })
					.where(eq(locations.id, match.id))
					.run();
			} else {
				tx.insert(locations)
					.values({
						gameId,
						slug: `custom-${kebab(entry)}`,
						name: entry.trim(),
						sortOrder,
					})
					.onConflictDoUpdate({
						target: [locations.gameId, locations.slug],
						set: { name: entry.trim(), sortOrder },
					})
					.run();
			}
		});
	}
}
