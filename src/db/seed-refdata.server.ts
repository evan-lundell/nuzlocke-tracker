import { readFileSync } from "node:fs";
import path from "node:path";
import type { Db } from "./client.server";
import { games, locations, species } from "./schema";

type GameJson = typeof games.$inferSelect;
type SpeciesJson = typeof species.$inferSelect;
type LocationJson = { slug: string; name: string; games: string[] };

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8"));

export const STARTER_SLUG = "starter";
// Below ordered locations (0+) and run custom locations pinned to the top (-1)
const STARTER_SORT_ORDER = -2;

/**
 * Loads bundled reference data. Safe to run on every startup. Games and
 * species are upserted; locations are insert-only, so names, order and
 * visibility edited on the admin page are never overwritten, and seeded
 * locations keep their ids (matched on game + slug) so encounters stay linked.
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
					.onConflictDoNothing()
					.run();
			}
		}

		// Every game gets a Starter encounter, separate from the first town,
		// always listed first
		for (const g of gameRows) {
			tx.insert(locations)
				.values({
					gameId: g.id,
					slug: STARTER_SLUG,
					name: "Starter",
					sortOrder: STARTER_SORT_ORDER,
				})
				.onConflictDoNothing()
				.run();
		}
	});
}
