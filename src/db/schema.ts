import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

// --- Reference data (seeded from data/pokedata on startup) ---

export const games = sqliteTable("games", {
	id: integer("id").primaryKey(), // PokeAPI version id
	slug: text("slug").notNull().unique(),
	name: text("name").notNull(),
	generation: integer("generation").notNull(),
	versionGroup: text("version_group").notNull(),
});

export const species = sqliteTable("species", {
	id: integer("id").primaryKey(), // national dex number
	slug: text("slug").notNull().unique(),
	name: text("name").notNull(),
	types: text("types", { mode: "json" }).$type<string[]>().notNull(),
});

export const locations = sqliteTable(
	"locations",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		gameId: integer("game_id")
			.notNull()
			.references(() => games.id),
		// PokeAPI location slug for seeded rows; null for custom rows
		slug: text("slug"),
		name: text("name").notNull(),
		// null = unordered (falls back to alphabetical after ordered rows)
		sortOrder: integer("sort_order"),
		// null = seeded for the game; set = custom location for one run
		runId: integer("run_id").references(() => runs.id, {
			onDelete: "cascade",
		}),
	},
	(t) => [
		uniqueIndex("locations_game_slug_idx").on(t.gameId, t.slug),
		index("locations_run_idx").on(t.runId),
	],
);

// --- User data ---

export const runStatuses = ["active", "completed", "failed"] as const;
export type RunStatus = (typeof runStatuses)[number];

export const runs = sqliteTable("runs", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	gameId: integer("game_id")
		.notNull()
		.references(() => games.id),
	rules: text("rules").notNull().default(""),
	status: text("status", { enum: runStatuses }).notNull().default("active"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

export const encounterOutcomes = [
	"caught",
	"failed",
	"missed",
	"skipped",
] as const;
export type EncounterOutcome = (typeof encounterOutcomes)[number];

export const pokemonStates = ["party", "box", "dead"] as const;
export type PokemonState = (typeof pokemonStates)[number];

export const encounters = sqliteTable(
	"encounters",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		runId: integer("run_id")
			.notNull()
			.references(() => runs.id, { onDelete: "cascade" }),
		locationId: integer("location_id")
			.notNull()
			.references(() => locations.id, { onDelete: "cascade" }),
		speciesId: integer("species_id").references(() => species.id),
		nickname: text("nickname").notNull().default(""),
		outcome: text("outcome", { enum: encounterOutcomes }).notNull(),
		// only set when outcome = caught
		state: text("state", { enum: pokemonStates }),
		// the one type that counts for the no-duplicate-types party rule; must be
		// one of the species' types, only set when outcome = caught
		ruleType: text("rule_type"),
		causeOfDeath: text("cause_of_death").notNull().default(""),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [uniqueIndex("encounters_run_location_idx").on(t.runId, t.locationId)],
);

export type Game = typeof games.$inferSelect;
export type Species = typeof species.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Encounter = typeof encounters.$inferSelect;
