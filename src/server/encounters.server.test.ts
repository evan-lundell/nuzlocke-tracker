import { describe, expect, it } from "vitest";
import { testDb } from "#/test/db";
import { listGameLocations, setLocationOrder } from "./admin.server";
import {
	addCustomLocation,
	compareLocations,
	listCaught,
	listRunLocations,
	resolveRuleType,
	saveEncounter,
	setPokemonState,
} from "./encounters.server";
import { createRun, listRuns } from "./runs.server";

const FIRERED = 10;

function setup() {
	const db = testDb();
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
			"Starter",
			"berry Forest",
			"Route 1",
			"Route 2",
			"Viridian Forest",
		]);
	});

	it("puts ordered locations first, then the rest alphabetically", () => {
		const { db, runId } = setup();
		const ids = new Map(
			listGameLocations(db, FIRERED).map((l) => [l.locationName, l.id]),
		);
		setLocationOrder(db, {
			gameId: FIRERED,
			orderedIds: [ids.get("Viridian Forest") ?? 0, ids.get("Route 1") ?? 0],
		});
		expect(names(db, runId)).toEqual([
			"Starter",
			"Viridian Forest",
			"Route 1",
			"berry Forest",
			"Route 2",
		]);
	});

	it("gives every game a Starter", () => {
		const db = testDb();
		const lg = createRun(db, { name: "LG", gameId: 11, rules: "" });
		expect(names(db, lg.id)[0]).toBe("Starter");
	});

	it("includes custom locations only for their run", () => {
		const { db, runId } = setup();
		const other = createRun(db, { name: "Other", gameId: FIRERED, rules: "" });
		addCustomLocation(db, { runId, name: "Gift Eevee", sortOrder: -1 });
		expect(names(db, runId).slice(0, 2)).toEqual(["Starter", "Gift Eevee"]);
		expect(names(db, other.id)).not.toContain("Gift Eevee");
	});

	it("only lists locations for the run's game", () => {
		const db = testDb();
		const run = createRun(db, { name: "LG", gameId: 11, rules: "" });
		expect(names(db, run.id)).toEqual(["Starter", "Route 1", "Route 2"]);
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

	it("stores the chosen rule type for dual-type catches", () => {
		const { db, runId } = setup();
		const route1 = locationId(db, runId, "Route 1");
		const base = { runId, locationId: route1, nickname: "" };
		saveEncounter(db, {
			...base,
			speciesId: 16,
			outcome: "caught",
			ruleType: "flying",
		});
		expect(listCaught(db, runId)[0]).toMatchObject({ ruleType: "flying" });

		// switching to a species without that type drops the choice
		saveEncounter(db, {
			...base,
			speciesId: 1,
			outcome: "caught",
			ruleType: "flying",
		});
		expect(listCaught(db, runId)[0]).toMatchObject({ ruleType: null });

		// single-type species pick their own type
		saveEncounter(db, { ...base, speciesId: 19, outcome: "caught" });
		expect(listCaught(db, runId)[0]).toMatchObject({ ruleType: "normal" });
	});
});

describe("resolveRuleType", () => {
	it("only applies to caught Pokémon", () => {
		expect(resolveRuleType(null, ["normal"], "normal")).toBeNull();
	});

	it("auto-picks for single types and validates dual types", () => {
		expect(resolveRuleType("box", ["normal"], null)).toBe("normal");
		expect(resolveRuleType("party", ["grass", "poison"], "poison")).toBe(
			"poison",
		);
		expect(resolveRuleType("party", ["grass", "poison"], "fire")).toBeNull();
		expect(resolveRuleType("dead", ["grass", "poison"], null)).toBeNull();
	});
});
