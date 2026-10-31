import { desc, eq, sql } from "drizzle-orm";
import type { Db } from "#/db/client.server";
import { encounters, games, type RunStatus, runs } from "#/db/schema";

const countState = (state: "party" | "box" | "dead") =>
	sql<number>`coalesce(sum(case when ${encounters.state} = ${state} then 1 else 0 end), 0)`;

export function listRuns(db: Db) {
	return db
		.select({
			id: runs.id,
			name: runs.name,
			status: runs.status,
			createdAt: runs.createdAt,
			gameName: games.name,
			party: countState("party"),
			box: countState("box"),
			dead: countState("dead"),
		})
		.from(runs)
		.innerJoin(games, eq(games.id, runs.gameId))
		.leftJoin(encounters, eq(encounters.runId, runs.id))
		.groupBy(runs.id)
		.orderBy(desc(runs.createdAt), desc(runs.id))
		.all();
}

export function getRun(db: Db, id: number) {
	return db
		.select({
			id: runs.id,
			name: runs.name,
			rules: runs.rules,
			status: runs.status,
			createdAt: runs.createdAt,
			gameId: runs.gameId,
			gameName: games.name,
		})
		.from(runs)
		.innerJoin(games, eq(games.id, runs.gameId))
		.where(eq(runs.id, id))
		.get();
}

export function createRun(
	db: Db,
	input: { name: string; gameId: number; rules: string },
) {
	return db.insert(runs).values(input).returning({ id: runs.id }).get();
}

export function updateRun(
	db: Db,
	input: { id: number; name?: string; rules?: string; status?: RunStatus },
) {
	const { id, ...changes } = input;
	db.update(runs).set(changes).where(eq(runs.id, id)).run();
}

export function deleteRun(db: Db, id: number) {
	db.delete(runs).where(eq(runs.id, id)).run();
}
