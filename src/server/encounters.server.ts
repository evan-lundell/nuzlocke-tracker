import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { Db } from "#/db/client.server";
import {
	type EncounterOutcome,
	encounters,
	locations,
	type PokemonState,
	runs,
	species,
} from "#/db/schema";

export const PARTY_SIZE = 6;

const naturalCollator = new Intl.Collator("en", {
	numeric: true,
	sensitivity: "base",
});

/**
 * Default ordering for location lists: rows with a sortOrder first (ascending),
 * then the rest in natural alphabetical order ("Route 2" before "Route 10").
 * Done in JS because SQLite has no natural-sort collation.
 */
export function compareLocations(
	a: { sortOrder: number | null; locationName: string },
	b: { sortOrder: number | null; locationName: string },
) {
	if (
		a.sortOrder !== null &&
		b.sortOrder !== null &&
		a.sortOrder !== b.sortOrder
	) {
		return a.sortOrder - b.sortOrder;
	}
	if ((a.sortOrder === null) !== (b.sortOrder === null)) {
		return a.sortOrder === null ? 1 : -1;
	}
	return naturalCollator.compare(a.locationName, b.locationName);
}

/** Seeded locations for the run's game plus the run's own custom locations. */
const runLocationsWhere = (runId: number, gameId: number) =>
	or(
		and(eq(locations.gameId, gameId), isNull(locations.runId)),
		eq(locations.runId, runId),
	);

function requireRun(db: Db, runId: number) {
	const run = db
		.select({ id: runs.id, gameId: runs.gameId })
		.from(runs)
		.where(eq(runs.id, runId))
		.get();
	if (!run) throw new Error("Run not found");
	return run;
}

function requireRunLocation(db: Db, runId: number, locationId: number) {
	const run = requireRun(db, runId);
	const location = db
		.select({ id: locations.id })
		.from(locations)
		.where(
			and(eq(locations.id, locationId), runLocationsWhere(runId, run.gameId)),
		)
		.get();
	if (!location) throw new Error("Location is not part of this run");
}

export function listRunLocations(db: Db, runId: number) {
	const run = requireRun(db, runId);
	return db
		.select({
			locationId: locations.id,
			locationName: locations.name,
			sortOrder: locations.sortOrder,
			isCustom: sql<boolean>`${locations.runId} is not null`.mapWith(Boolean),
			encounterId: encounters.id,
			speciesId: encounters.speciesId,
			speciesName: species.name,
			speciesTypes: species.types,
			nickname: encounters.nickname,
			outcome: encounters.outcome,
			state: encounters.state,
			ruleType: encounters.ruleType,
		})
		.from(locations)
		.leftJoin(
			encounters,
			and(eq(encounters.locationId, locations.id), eq(encounters.runId, runId)),
		)
		.leftJoin(species, eq(species.id, encounters.speciesId))
		.where(runLocationsWhere(runId, run.gameId))
		.all()
		.sort(compareLocations);
}

export function listCaught(db: Db, runId: number) {
	return db
		.select({
			id: encounters.id,
			speciesId: encounters.speciesId,
			speciesName: species.name,
			types: species.types,
			ruleType: encounters.ruleType,
			nickname: encounters.nickname,
			state: encounters.state,
			causeOfDeath: encounters.causeOfDeath,
			locationName: locations.name,
		})
		.from(encounters)
		.innerJoin(locations, eq(locations.id, encounters.locationId))
		.leftJoin(species, eq(species.id, encounters.speciesId))
		.where(and(eq(encounters.runId, runId), eq(encounters.outcome, "caught")))
		.orderBy(encounters.createdAt, encounters.id)
		.all();
}

export function saveEncounter(
	db: Db,
	input: {
		runId: number;
		locationId: number;
		speciesId: number | null;
		nickname: string;
		outcome: EncounterOutcome;
		ruleType?: string | null;
	},
) {
	requireRunLocation(db, input.runId, input.locationId);
	const types = input.speciesId
		? db
				.select({ types: species.types })
				.from(species)
				.where(eq(species.id, input.speciesId))
				.get()?.types
		: undefined;
	if (input.speciesId && !types) throw new Error("Unknown Pokémon");
	const existing = db
		.select({ state: encounters.state })
		.from(encounters)
		.where(
			and(
				eq(encounters.runId, input.runId),
				eq(encounters.locationId, input.locationId),
			),
		)
		.get();

	// New catches land in the box; re-saving a catch keeps where it is now
	const state = input.outcome === "caught" ? (existing?.state ?? "box") : null;
	const values = {
		...input,
		ruleType: resolveRuleType(state, types ?? [], input.ruleType ?? null),
		state,
		causeOfDeath: state === "dead" ? undefined : "",
	};
	db.insert(encounters)
		.values(values)
		.onConflictDoUpdate({
			target: [encounters.runId, encounters.locationId],
			set: values,
		})
		.run();
}

/**
 * The type that counts for the no-duplicate-types rule. Only caught Pokémon
 * have one; single-type species get theirs automatically, and a choice that
 * isn't one of the species' types (e.g. after changing species) is dropped.
 */
export function resolveRuleType(
	state: PokemonState | null,
	types: string[],
	chosen: string | null,
) {
	if (!state) return null;
	if (types.length === 1) return types[0];
	return chosen && types.includes(chosen) ? chosen : null;
}

export function clearEncounter(
	db: Db,
	input: { runId: number; locationId: number },
) {
	db.delete(encounters)
		.where(
			and(
				eq(encounters.runId, input.runId),
				eq(encounters.locationId, input.locationId),
			),
		)
		.run();
}

export function addCustomLocation(
	db: Db,
	input: { runId: number; name: string; sortOrder: number | null },
) {
	const run = requireRun(db, input.runId);
	return db
		.insert(locations)
		.values({
			gameId: run.gameId,
			runId: run.id,
			name: input.name,
			sortOrder: input.sortOrder,
		})
		.returning({ id: locations.id })
		.get();
}

export function deleteCustomLocation(
	db: Db,
	input: { runId: number; locationId: number },
) {
	db.delete(locations)
		.where(
			and(eq(locations.id, input.locationId), eq(locations.runId, input.runId)),
		)
		.run();
}

export function setPokemonState(
	db: Db,
	input: { encounterId: number; state: PokemonState; causeOfDeath: string },
) {
	db.transaction((tx) => {
		const enc = tx
			.select({
				runId: encounters.runId,
				outcome: encounters.outcome,
				state: encounters.state,
			})
			.from(encounters)
			.where(eq(encounters.id, input.encounterId))
			.get();
		if (!enc) throw new Error("Encounter not found");
		if (enc.outcome !== "caught") {
			throw new Error("Only caught Pokémon can be moved");
		}

		if (input.state === "party" && enc.state !== "party") {
			const party = tx
				.select({ n: sql<number>`count(*)` })
				.from(encounters)
				.where(
					and(eq(encounters.runId, enc.runId), eq(encounters.state, "party")),
				)
				.get();
			if ((party?.n ?? 0) >= PARTY_SIZE) {
				throw new Error(`Party is full (max ${PARTY_SIZE})`);
			}
		}

		tx.update(encounters)
			.set({
				state: input.state,
				causeOfDeath: input.state === "dead" ? input.causeOfDeath : "",
			})
			.where(eq(encounters.id, input.encounterId))
			.run();
	});
}
