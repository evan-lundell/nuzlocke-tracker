import { describe, expect, it } from "vitest";
import { seedRefdata } from "#/db/seed-refdata.server";
import { testDb, writePokedata } from "#/test/db";
import {
	addCustomLocation,
	compareLocations,
	listCaught,
	listRunLocations,
	saveEncounter,
	setPokemonState,
} from "./encounters.server";
import { createRun, listRuns } from "./runs.server";

const FIRERED = 10;

function setup(routeOrder?: Record<string, string[]>) {
	const db = testDb(routeOrder);
	const run = createRun(db, { name: "Test", gameId: FIRERED, rules: "" });
	return { db, runId: run.id };
}

const names = (db: ReturnType<typeof testDb>, runId: number) =>
	listRunLocations(db, runId).map((l) => l.locationName);

describe("location ordering", () => {
	it("sorts numbers naturally in the alphabetical fallback", () => {
		const loc = (locationName: string, sortOrder: number | null = null) => ({
			locationName,
			sortOrder,
		});
		const sorted = [
			loc("Route 10"),
			loc("Route 2"),
			loc("Starter", -1),
			loc("route 1"),
			loc("Pallet Town", 3),
		]
			.sort(compareLocations)
			.map((l) => l.locationName);
		expect(sorted).toEqual([
			"Starter",
			"Pallet Town",
			"route 1",
			"Route 2",
			"Route 10",
		]);
	});

	it("falls back to case-insensitive alphabetical", () => {
		const { db, runId } = setup();
		expect(names(db, runId)).toEqual([
			"berry Forest",
			"Route 1",
			"Route 2",
			"Viridian Forest",
		]);
	});

	it("puts ordered locations first, then the rest alphabetically", () => {
		const { db, runId } = setup({ firered: ["Viridian Forest", "route 1"] });
		expect(names(db, runId)).toEqual([
			"Viridian Forest",
			"Route 1",
			"berry Forest",
			"Route 2",
		]);
	});

	it("adds unknown route-order names as game locations", () => {
		const { db, runId } = setup({ firered: ["Starter", "Route 1"] });
		expect(names(db, runId).slice(0, 2)).toEqual(["Starter", "Route 1"]);
	});

	it("resets order when a location is removed from the file", () => {
		const { db, runId } = setup({ firered: ["Viridian Forest"] });
		seedRefdata(db, writePokedata());
		expect(names(db, runId)[0]).toBe("berry Forest");
	});

	it("includes custom locations only for their run", () => {
		const { db, runId } = setup();
		const other = createRun(db, { name: "Other", gameId: FIRERED, rules: "" });
		addCustomLocation(db, { runId, name: "Starter", sortOrder: 0 });
		expect(names(db, runId)[0]).toBe("Starter");
		expect(names(db, other.id)).not.toContain("Starter");
	});

	it("only lists locations for the run's game", () => {
		const db = testDb();
		const run = createRun(db, { name: "LG", gameId: 11, rules: "" });
		expect(names(db, run.id)).toEqual(["Route 1", "Route 2"]);
	});
});

describe("encounters", () => {
	const locationId = (
		db: ReturnType<typeof testDb>,
		runId: number,
		name: string,
	) => {
		const loc = listRunLocations(db, runId).find(
			(l) => l.locationName === name,
		);
		if (!loc) throw new Error(`no location ${name}`);
		return loc.locationId;
	};

	it("puts new catches in the box and keeps one encounter per location", () => {
		const { db, runId } = setup();
		const route1 = locationId(db, runId, "Route 1");
		saveEncounter(db, {
			runId,
			locationId: route1,
			speciesId: 16,
			nickname: "Birb",
			outcome: "caught",
		});
		saveEncounter(db, {
			runId,
			locationId: route1,
			speciesId: 19,
			nickname: "Rat",
			outcome: "caught",
		});
		const caught = listCaught(db, runId);
		expect(caught).toHaveLength(1);
		expect(caught[0]).toMatchObject({
			speciesName: "Rattata",
			nickname: "Rat",
			state: "box",
		});
	});

	it("clears state when the outcome is not caught", () => {
		const { db, runId } = setup();
		const route1 = locationId(db, runId, "Route 1");
		const base = { runId, locationId: route1, speciesId: 16, nickname: "" };
		saveEncounter(db, { ...base, outcome: "caught" });
		saveEncounter(db, { ...base, outcome: "failed" });
		const row = listRunLocations(db, runId).find(
			(l) => l.locationId === route1,
		);
		expect(row).toMatchObject({ outcome: "failed", state: null });
		expect(listCaught(db, runId)).toHaveLength(0);
	});

	it("rejects locations from another game", () => {
		const db = testDb();
		const lg = createRun(db, { name: "LG", gameId: 11, rules: "" });
		const fr = createRun(db, { name: "FR", gameId: FIRERED, rules: "" });
		const forest = locationId(db, fr.id, "Viridian Forest");
		expect(() =>
			saveEncounter(db, {
				runId: lg.id,
				locationId: forest,
				speciesId: 1,
				nickname: "",
				outcome: "caught",
			}),
		).toThrow(/not part of this run/);
	});

	it("caps the party at 6 and records cause of death", () => {
		const { db, runId } = setup();
		const ids = Array.from({ length: 7 }, (_, i) => {
			const loc = addCustomLocation(db, {
				runId,
				name: `Spot ${i}`,
				sortOrder: null,
			});
			saveEncounter(db, {
				runId,
				locationId: loc.id,
				speciesId: 19,
				nickname: `R${i}`,
				outcome: "caught",
			});
			return listCaught(db, runId).at(-1)?.id ?? 0;
		});

		for (const id of ids.slice(0, 6)) {
			setPokemonState(db, {
				encounterId: id,
				state: "party",
				causeOfDeath: "",
			});
		}
		expect(() =>
			setPokemonState(db, {
				encounterId: ids[6],
				state: "party",
				causeOfDeath: "",
			}),
		).toThrow(/Party is full/);

		setPokemonState(db, {
			encounterId: ids[0],
			state: "dead",
			causeOfDeath: "Crit from Brock's Onix",
		});
		setPokemonState(db, {
			encounterId: ids[6],
			state: "party",
			causeOfDeath: "",
		});

		const dead = listCaught(db, runId).find((c) => c.id === ids[0]);
		expect(dead).toMatchObject({
			state: "dead",
			causeOfDeath: "Crit from Brock's Onix",
		});
		expect(listRuns(db)[0]).toMatchObject({ party: 6, box: 0, dead: 1 });
	});
});
