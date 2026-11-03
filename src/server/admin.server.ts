import {
	and,
	count,
	countDistinct,
	eq,
	isNull,
	max,
	ne,
	sql,
} from "drizzle-orm";
import type { Db } from "#/db/client.server";
import {
	battleCompletions,
	encounters,
	games,
	type LocationKind,
	locations,
} from "#/db/schema";
import { STARTER_SLUG } from "#/db/seed-refdata.server";
import { compareLocations } from "./encounters.server";

// Locations added on the admin page get this slug prefix
const CUSTOM_PREFIX = "custom-";
// Keeps a battle and a location with the same name from colliding
const BATTLE_PREFIX = `${CUSTOM_PREFIX}battle-`;

const kebab = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

/** Game-level locations the admin page manages: everything but Starter. */
const editableWhere = (gameId: number) =>
	and(
		eq(locations.gameId, gameId),
		isNull(locations.runId),
		ne(locations.slug, STARTER_SLUG),
	);

function requireEditable(db: Db, locationId: number) {
	const loc = db
		.select({
			id: locations.id,
			gameId: locations.gameId,
			slug: locations.slug,
			kind: locations.kind,
		})
		.from(locations)
		.where(
			and(
				eq(locations.id, locationId),
				isNull(locations.runId),
				ne(locations.slug, STARTER_SLUG),
			),
		)
		.get();
	if (!loc) throw new Error("Location not found");
	return loc;
}

function encounterCount(db: Db, locationId: number) {
	return (
		db
			.select({ n: count() })
			.from(encounters)
			.where(eq(encounters.locationId, locationId))
			.get()?.n ?? 0
	);
}

export function listGameLocations(db: Db, gameId: number) {
	return db
		.select({
			id: locations.id,
			locationName: locations.name,
			sortOrder: locations.sortOrder,
			kind: locations.kind,
			levelCap: locations.levelCap,
			hidden: locations.hidden,
			isCustom:
				sql<boolean>`${locations.slug} like ${`${CUSTOM_PREFIX}%`}`.mapWith(
					Boolean,
				),
			encounterCount: countDistinct(encounters.id),
			completionCount: countDistinct(battleCompletions.runId),
		})
		.from(locations)
		.leftJoin(encounters, eq(encounters.locationId, locations.id))
		.leftJoin(battleCompletions, eq(battleCompletions.locationId, locations.id))
		.where(editableWhere(gameId))
		.groupBy(locations.id)
		.all()
		.sort(compareLocations);
}

/**
 * Sets the game's order: listed locations get sortOrder = their index, and
 * every other editable location becomes unordered (alphabetical fallback).
 */
export function setLocationOrder(
	db: Db,
	input: { gameId: number; orderedIds: number[] },
) {
	db.transaction((tx) => {
		const editable = new Set(
			tx
				.select({ id: locations.id })
				.from(locations)
				.where(editableWhere(input.gameId))
				.all()
				.map((l) => l.id),
		);
		if (new Set(input.orderedIds).size !== input.orderedIds.length) {
			throw new Error("Duplicate locations in order");
		}
		for (const id of input.orderedIds) {
			if (!editable.has(id))
				throw new Error("Location is not part of this game");
		}

		tx.update(locations)
			.set({ sortOrder: null })
			.where(editableWhere(input.gameId))
			.run();
		input.orderedIds.forEach((id, sortOrder) => {
			tx.update(locations).set({ sortOrder }).where(eq(locations.id, id)).run();
		});
	});
}

export function setLocationHidden(
	db: Db,
	input: { locationId: number; hidden: boolean },
) {
	requireEditable(db, input.locationId);
	db.update(locations)
		.set({ hidden: input.hidden })
		.where(eq(locations.id, input.locationId))
		.run();
}

export function renameLocation(
	db: Db,
	input: { locationId: number; name: string },
) {
	requireEditable(db, input.locationId);
	db.update(locations)
		.set({ name: input.name })
		.where(eq(locations.id, input.locationId))
		.run();
}

/** Sets a battle's level cap; null means it has none. */
export function setBattleLevelCap(
	db: Db,
	input: { locationId: number; levelCap: number | null },
) {
	const loc = requireEditable(db, input.locationId);
	if (loc.kind !== "battle") throw new Error("Only battles have a level cap");
	db.update(locations)
		.set({ levelCap: input.levelCap })
		.where(eq(locations.id, loc.id))
		.run();
	// useAction reads undefined as failure
	return { levelCap: input.levelCap };
}

/** Adds a game-level row at the end of the game's order. */
function insertGameRow(
	db: Db,
	input: {
		gameId: number;
		name: string;
		kind: LocationKind;
		slugPrefix: string;
		levelCap: number | null;
	},
) {
	const game = db
		.select({ id: games.id })
		.from(games)
		.where(eq(games.id, input.gameId))
		.get();
	if (!game) throw new Error("Game not found");

	const slug = kebab(input.name);
	if (!slug) throw new Error("Name needs at least one letter or number");

	const last = db
		.select({ n: max(locations.sortOrder) })
		.from(locations)
		.where(editableWhere(input.gameId))
		.get()?.n;

	const row = db
		.insert(locations)
		.values({
			gameId: input.gameId,
			slug: `${input.slugPrefix}${slug}`,
			name: input.name,
			kind: input.kind,
			levelCap: input.levelCap,
			sortOrder: last == null ? 0 : last + 1,
		})
		.onConflictDoNothing()
		.returning({ id: locations.id })
		.get();
	if (!row) throw new Error(`"${input.name}" already exists for this game`);
	return row;
}

export function addGameLocation(
	db: Db,
	input: { gameId: number; name: string },
) {
	return insertGameRow(db, {
		...input,
		kind: "location",
		slugPrefix: CUSTOM_PREFIX,
		levelCap: null,
	});
}

export function addGameBattle(
	db: Db,
	input: { gameId: number; name: string; levelCap: number | null },
) {
	return insertGameRow(db, {
		...input,
		kind: "battle",
		slugPrefix: BATTLE_PREFIX,
	});
}

/**
 * Deletes a location or battle added on the admin page. Refuses if any run has
 * logged an encounter or completed the battle, since deleting would delete
 * that progress too.
 */
export function deleteGameLocation(db: Db, input: { locationId: number }) {
	const loc = requireEditable(db, input.locationId);
	if (!loc.slug?.startsWith(CUSTOM_PREFIX)) {
		throw new Error("Only added locations can be deleted; hide it instead");
	}
	if (encounterCount(db, loc.id) > 0) {
		throw new Error("This location has encounters logged; hide it instead");
	}
	const completed = db
		.select({ n: count() })
		.from(battleCompletions)
		.where(eq(battleCompletions.locationId, loc.id))
		.get()?.n;
	if (completed) {
		throw new Error("A run has completed this battle; hide it instead");
	}
	db.delete(locations).where(eq(locations.id, loc.id)).run();
}
