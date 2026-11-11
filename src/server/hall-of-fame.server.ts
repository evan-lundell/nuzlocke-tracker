import { and, eq, sql } from "drizzle-orm";
import type { Db } from "#/db/client.server";
import {
	battleCompletions,
	encounters,
	type HallOfFameMember,
	hallOfFame,
	runs,
} from "#/db/schema";
import { listCaught } from "./encounters.server";
import { getRun } from "./runs.server";

export function getHallOfFame(db: Db, runId: number) {
	return (
		db.select().from(hallOfFame).where(eq(hallOfFame.runId, runId)).get() ??
		null
	);
}

/**
 * Snapshots the current party into the run's Hall of Fame entry (replacing any
 * earlier one) and marks the run completed.
 */
export function enterHallOfFame(db: Db, runId: number) {
	if (!getRun(db, runId)) throw new Error("Run not found");

	const members: HallOfFameMember[] = listCaught(db, runId)
		.filter((m) => m.state === "party")
		.map((m) => ({
			speciesId: m.speciesId,
			speciesName: m.speciesName,
			nickname: m.nickname,
			types: m.types ?? [],
			metAt: m.locationName,
		}));
	if (members.length === 0) {
		throw new Error("Your party is empty, so there's no one to induct");
	}

	const battlesWon = db
		.select({ n: sql<number>`count(*)` })
		.from(battleCompletions)
		.where(eq(battleCompletions.runId, runId))
		.get()?.n;
	const deaths = db
		.select({ n: sql<number>`count(*)` })
		.from(encounters)
		.where(and(eq(encounters.runId, runId), eq(encounters.state, "dead")))
		.get()?.n;

	const values = {
		runId,
		members,
		battlesWon: battlesWon ?? 0,
		deaths: deaths ?? 0,
		inductedAt: new Date(),
	};
	return db.transaction((tx) => {
		tx.update(runs)
			.set({ status: "completed" })
			.where(eq(runs.id, runId))
			.run();
		return tx
			.insert(hallOfFame)
			.values(values)
			.onConflictDoUpdate({ target: hallOfFame.runId, set: values })
			.returning()
			.get();
	});
}

export function removeHallOfFame(db: Db, runId: number) {
	db.delete(hallOfFame).where(eq(hallOfFame.runId, runId)).run();
	// useAction reads undefined as failure
	return { removed: true };
}
