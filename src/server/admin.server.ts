import { and, count, eq, isNull, max, ne, sql } from "drizzle-orm";
import type { Db } from "#/db/client.server";
import { encounters, games, locations } from "#/db/schema";
import { STARTER_SLUG } from "#/db/seed-refdata.server";
import { compareLocations } from "./encounters.server";

// Locations added on the admin page get this slug prefix
const CUSTOM_PREFIX = "custom-";

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
			hidden: locations.hidden,
			isCustom:
				sql<boolean>`${locations.slug} like ${`${CUSTOM_PREFIX}%`}`.mapWith(
					Boolean,
				),
			encounterCount: count(encounters.id),
		})
		.from(locations)
		.leftJoin(encounters, eq(encounters.locationId, locations.id))
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

/** Adds a game-level location at the end of the game's order. */
export function addGameLocation(
	db: Db,
	input: { gameId: number; name: string },
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
			slug: `${CUSTOM_PREFIX}${slug}`,
			name: input.name,
			sortOrder: last == null ? 0 : last + 1,
		})
		.onConflictDoNothing()
		.returning({ id: locations.id })
		.get();
	if (!row) throw new Error(`"${input.name}" already exists for this game`);
	return row;
}

/**
 * Deletes a location added on the admin page. Refuses if any run has logged
 * an encounter there, since deleting would delete those encounters too.
 */
export function deleteGameLocation(db: Db, input: { locationId: number }) {
	const loc = requireEditable(db, input.locationId);
	if (!loc.slug?.startsWith(CUSTOM_PREFIX)) {
		throw new Error("Only added locations can be deleted; hide it instead");
	}
	if (encounterCount(db, loc.id) > 0) {
		throw new Error("This location has encounters logged; hide it instead");
	}
	db.delete(locations).where(eq(locations.id, loc.id)).run();
}
