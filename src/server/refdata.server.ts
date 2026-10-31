import { asc } from "drizzle-orm";
import type { Db } from "#/db/client.server";
import { games, species } from "#/db/schema";

export function listGames(db: Db) {
	return db.select().from(games).orderBy(asc(games.id)).all();
}

export function listSpecies(db: Db) {
	return db
		.select({
			id: species.id,
			name: species.name,
			types: species.types,
			evolvesFromId: species.evolvesFromId,
		})
		.from(species)
		.orderBy(asc(species.id))
		.all();
}
