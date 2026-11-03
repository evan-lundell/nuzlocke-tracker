import { describe, expect, it } from "vitest";
import { testDb } from "#/test/db";
import {
	addGameBattle,
	listGameLocations,
	setLocationHidden,
	setLocationOrder,
} from "./admin.server";
import {
	addCustomLocation,
	compareLocations,
	evolvePokemon,
	exportEncounters,
	listCaught,
	listRunLocations,
	resolveRuleType,
	saveEncounter,
	setBattleCompleted,
	setPokemonState,
} from "./encounters.server";
import { createRun, deleteRun, listRuns } from "./runs.server";

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

describe("evolution", () => {
	function catchOne(speciesId: number, ruleType: string | null = null) {
		const { db, runId } = setup();
		const loc = addCustomLocation(db, { runId, name: "Spot", sortOrder: null });
		saveEncounter(db, {
			runId,
			locationId: loc.id,
			speciesId,
			nickname: "",
			outcome: "caught",
			ruleType,
		});
		const mon = listCaught(db, runId)[0];
		return { db, runId, mon };
	}

	it("lists every evolution option", () => {
		const { mon } = catchOne(133);
		expect(mon.evolutions.map((e) => e.name)).toEqual(["Vaporeon", "Jolteon"]);
		expect(catchOne(19).mon.evolutions).toEqual([]);
	});

	it("keeps the rule type by default and lets a dual type switch", () => {
		const { db, runId, mon } = catchOne(129);
		expect(mon.ruleType).toBe("water");
		evolvePokemon(db, { encounterId: mon.id, speciesId: 130, ruleType: null });
		expect(listCaught(db, runId)[0]).toMatchObject({
			speciesName: "Gyarados",
			ruleType: "water",
		});

		const again = catchOne(129);
		evolvePokemon(again.db, {
			encounterId: again.mon.id,
			speciesId: 130,
			ruleType: "flying",
		});
		expect(listCaught(again.db, again.runId)[0].ruleType).toBe("flying");
	});

	it("takes the new type when evolving into a single type", () => {
		const { db, runId, mon } = catchOne(133);
		evolvePokemon(db, { encounterId: mon.id, speciesId: 135, ruleType: null });
		expect(listCaught(db, runId)[0]).toMatchObject({
			speciesName: "Jolteon",
			ruleType: "electric",
		});
	});

	it("rejects species that aren't an evolution, and dead Pokémon", () => {
		const { db, mon } = catchOne(16, "flying");
		expect(() =>
			evolvePokemon(db, {
				encounterId: mon.id,
				speciesId: 130,
				ruleType: null,
			}),
		).toThrow(/isn't an evolution/);
		setPokemonState(db, {
			encounterId: mon.id,
			state: "dead",
			causeOfDeath: "",
		});
		expect(() =>
			evolvePokemon(db, { encounterId: mon.id, speciesId: 17, ruleType: null }),
		).toThrow(/Only living/);
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

describe("exportEncounters", () => {
	const locationId = (
		db: ReturnType<typeof testDb>,
		runId: number,
		name: string,
	) =>
		listRunLocations(db, runId).find((l) => l.locationName === name)
			?.locationId ?? 0;

	it("exports only logged encounters, in location order", () => {
		const { db, runId } = setup();
		saveEncounter(db, {
			runId,
			locationId: locationId(db, runId, "Route 2"),
			speciesId: null,
			nickname: "",
			outcome: "missed",
		});
		saveEncounter(db, {
			runId,
			locationId: locationId(db, runId, "Route 1"),
			speciesId: 16,
			nickname: "Birdie",
			outcome: "caught",
			ruleType: "flying",
		});

		const { run, encounters } = exportEncounters(db, runId);

		expect(run).toEqual({ name: "Test", game: "FireRed", status: "active" });
		expect(encounters).toEqual([
			{
				location: "Route 1",
				speciesName: "Pidgey",
				types: ["normal", "flying"],
				nickname: "Birdie",
				outcome: "caught",
				state: "box",
				ruleType: "flying",
				causeOfDeath: "",
				loggedAt: expect.any(Date),
			},
			{
				location: "Route 2",
				speciesName: null,
				types: null,
				nickname: "",
				outcome: "missed",
				state: null,
				ruleType: null,
				causeOfDeath: "",
				loggedAt: expect.any(Date),
			},
		]);
	});

	it("leaves out other runs' encounters", () => {
		const { db, runId } = setup();
		const other = createRun(db, { name: "Other", gameId: FIRERED, rules: "" });
		saveEncounter(db, {
			runId: other.id,
			locationId: locationId(db, other.id, "Route 1"),
			speciesId: 19,
			nickname: "",
			outcome: "caught",
		});

		expect(exportEncounters(db, runId).encounters).toEqual([]);
	});

	it("throws for an unknown run", () => {
		const { db } = setup();
		expect(() => exportEncounters(db, 999)).toThrow("Run not found");
	});
});

describe("battles", () => {
	const LEAFGREEN = 11;
	const setupBattle = () => {
		const { db, runId } = setup();
		const { id } = addGameBattle(db, {
			gameId: FIRERED,
			name: "Brock",
			levelCap: 14,
		});
		const battle = (r = runId) =>
			listRunLocations(db, r).find((l) => l.locationId === id);
		return { db, runId, id, battle };
	};

	it("toggles completion for one run only", () => {
		const { db, runId, id, battle } = setupBattle();
		const other = createRun(db, { name: "Other", gameId: FIRERED, rules: "" });
		expect(battle()?.completedAt).toBeNull();

		setBattleCompleted(db, { runId, locationId: id, completed: true });
		setBattleCompleted(db, { runId, locationId: id, completed: true });
		expect(battle()?.completedAt).toBeInstanceOf(Date);
		expect(battle(other.id)?.completedAt).toBeNull();

		setBattleCompleted(db, { runId, locationId: id, completed: false });
		expect(battle()?.completedAt).toBeNull();
	});

	it("rejects completing a location or another game's battle", () => {
		const { db, runId } = setupBattle();
		const route = listRunLocations(db, runId).find(
			(l) => l.locationName === "Route 1",
		);
		const elsewhere = addGameBattle(db, {
			gameId: LEAFGREEN,
			name: "Misty",
			levelCap: 21,
		});
		for (const locationId of [route?.locationId ?? 0, elsewhere.id]) {
			expect(() =>
				setBattleCompleted(db, { runId, locationId, completed: true }),
			).toThrow(/Battle is not part of this run/);
		}
	});

	it("rejects saving an encounter on a battle", () => {
		const { db, runId, id } = setupBattle();
		expect(() =>
			saveEncounter(db, {
				runId,
				locationId: id,
				speciesId: null,
				nickname: "",
				outcome: "missed",
			}),
		).toThrow(/Location is not part of this run/);
	});

	it("keeps a hidden battle visible only in runs that completed it", () => {
		const { db, runId, id, battle } = setupBattle();
		const other = createRun(db, { name: "Other", gameId: FIRERED, rules: "" });
		setBattleCompleted(db, { runId, locationId: id, completed: true });
		setLocationHidden(db, { locationId: id, hidden: true });
		expect(battle()).toBeDefined();
		expect(battle(other.id)).toBeUndefined();
	});

	it("exports battles in game order without changing encounters", () => {
		const { db, runId, id } = setupBattle();
		const misty = addGameBattle(db, {
			gameId: FIRERED,
			name: "Misty",
			levelCap: null,
		});
		const route = listRunLocations(db, runId).find(
			(l) => l.locationName === "Route 1",
		);
		setLocationOrder(db, { gameId: FIRERED, orderedIds: [misty.id, id] });
		setBattleCompleted(db, { runId, locationId: id, completed: true });
		saveEncounter(db, {
			runId,
			locationId: route?.locationId ?? 0,
			speciesId: null,
			nickname: "",
			outcome: "missed",
		});

		const { battles, encounters } = exportEncounters(db, runId);
		expect(battles).toEqual([
			{ name: "Misty", levelCap: null, completedAt: null },
			{ name: "Brock", levelCap: 14, completedAt: expect.any(Date) },
		]);
		expect(encounters.map((e) => e.location)).toEqual(["Route 1"]);
	});

	it("deletes completions along with the run", () => {
		const { db, runId, id } = setupBattle();
		setBattleCompleted(db, { runId, locationId: id, completed: true });
		deleteRun(db, runId);
		const row = listGameLocations(db, FIRERED).find((l) => l.id === id);
		expect(row?.completionCount).toBe(0);
	});
});
