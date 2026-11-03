import { describe, expect, it } from "vitest";
import { seedRefdata } from "#/db/seed-refdata.server";
import { testDb, writePokedata } from "#/test/db";
import {
	addGameBattle,
	addGameLocation,
	deleteGameLocation,
	listGameLocations,
	renameLocation,
	setBattleLevelCap,
	setLocationHidden,
	setLocationOrder,
} from "./admin.server";
import {
	listRunLocations,
	saveEncounter,
	setBattleCompleted,
} from "./encounters.server";
import { createRun } from "./runs.server";

const FIRERED = 10;
const LEAFGREEN = 11;

function setup() {
	const db = testDb();
	const run = createRun(db, { name: "Test", gameId: FIRERED, rules: "" });
	const idOf = (name: string) => {
		const loc = listGameLocations(db, FIRERED).find(
			(l) => l.locationName === name,
		);
		if (!loc) throw new Error(`no location ${name}`);
		return loc.id;
	};
	const runNames = () =>
		listRunLocations(db, run.id).map((l) => l.locationName);
	return { db, runId: run.id, idOf, runNames };
}

describe("admin locations", () => {
	it("lists a game's locations without Starter", () => {
		const { db } = setup();
		expect(listGameLocations(db, FIRERED).map((l) => l.locationName)).toEqual([
			"berry Forest",
			"Route 1",
			"Route 2",
			"Viridian Forest",
		]);
	});

	it("sets order and unorders anything left out", () => {
		const { db, idOf, runNames } = setup();
		setLocationOrder(db, {
			gameId: FIRERED,
			orderedIds: [idOf("Route 2"), idOf("Route 1")],
		});
		setLocationOrder(db, { gameId: FIRERED, orderedIds: [idOf("Route 1")] });
		expect(runNames()).toEqual([
			"Starter",
			"Route 1",
			"berry Forest",
			"Route 2",
			"Viridian Forest",
		]);
	});

	it("rejects ordering locations from another game", () => {
		const { db, idOf } = setup();
		expect(() =>
			setLocationOrder(db, {
				gameId: LEAFGREEN,
				orderedIds: [idOf("Viridian Forest")],
			}),
		).toThrow(/not part of this game/);
	});

	it("keeps admin edits when reference data is reseeded", () => {
		const { db, idOf, runNames } = setup();
		setLocationOrder(db, { gameId: FIRERED, orderedIds: [idOf("Route 2")] });
		renameLocation(db, {
			locationId: idOf("berry Forest"),
			name: "Berry Forest",
		});
		setLocationHidden(db, {
			locationId: idOf("Viridian Forest"),
			hidden: true,
		});

		seedRefdata(db, writePokedata());

		expect(runNames()).toEqual([
			"Starter",
			"Route 2",
			"Berry Forest",
			"Route 1",
		]);
	});

	it("hides locations unless the run already logged an encounter there", () => {
		const { db, runId, idOf, runNames } = setup();
		const forest = idOf("Viridian Forest");
		saveEncounter(db, {
			runId,
			locationId: forest,
			speciesId: 16,
			nickname: "",
			outcome: "caught",
		});
		setLocationHidden(db, { locationId: forest, hidden: true });
		setLocationHidden(db, { locationId: idOf("Route 2"), hidden: true });

		expect(runNames()).toContain("Viridian Forest");
		expect(runNames()).not.toContain("Route 2");
	});

	it("adds locations at the end of the order and rejects duplicates", () => {
		const { db, idOf, runNames } = setup();
		addGameLocation(db, { gameId: FIRERED, name: "Pallet Town" });
		setLocationOrder(db, {
			gameId: FIRERED,
			orderedIds: [idOf("Pallet Town"), idOf("Route 1")],
		});
		addGameLocation(db, { gameId: FIRERED, name: "Mt. Moon" });

		expect(runNames().slice(0, 4)).toEqual([
			"Starter",
			"Pallet Town",
			"Route 1",
			"Mt. Moon",
		]);
		expect(() =>
			addGameLocation(db, { gameId: FIRERED, name: "mt moon" }),
		).toThrow(/already exists/);
	});

	it("only deletes added locations with no encounters", () => {
		const { db, runId, idOf } = setup();
		const added = addGameLocation(db, { gameId: FIRERED, name: "Fossil" });

		expect(() =>
			deleteGameLocation(db, { locationId: idOf("Route 1") }),
		).toThrow(/hide it instead/);

		saveEncounter(db, {
			runId,
			locationId: added.id,
			speciesId: 1,
			nickname: "",
			outcome: "caught",
		});
		expect(() => deleteGameLocation(db, { locationId: added.id })).toThrow(
			/encounters logged/,
		);

		const unused = addGameLocation(db, { gameId: FIRERED, name: "Gift" });
		deleteGameLocation(db, { locationId: unused.id });
		expect(
			listGameLocations(db, FIRERED).some((l) => l.locationName === "Gift"),
		).toBe(false);
	});

	it("won't edit Starter or per-run custom locations", () => {
		const { db, runId } = setup();
		const starter = listRunLocations(db, runId)[0];
		expect(starter.locationName).toBe("Starter");
		expect(() =>
			setLocationHidden(db, { locationId: starter.locationId, hidden: true }),
		).toThrow(/not found/);
	});
});

describe("admin battles", () => {
	const brock = { gameId: FIRERED, name: "Brock", levelCap: 14 };

	it("adds a battle at the end of the order, with its cap", () => {
		const { db, idOf } = setup();
		setLocationOrder(db, { gameId: FIRERED, orderedIds: [idOf("Route 2")] });
		addGameBattle(db, brock);
		expect(
			listGameLocations(db, FIRERED)
				.slice(0, 2)
				.map((l) => [l.locationName, l.kind, l.sortOrder, l.levelCap]),
		).toEqual([
			["Route 2", "location", 0, null],
			["Brock", "battle", 1, 14],
		]);
	});

	it("orders battles between locations", () => {
		const { db, idOf, runNames } = setup();
		const { id } = addGameBattle(db, brock);
		setLocationOrder(db, {
			gameId: FIRERED,
			orderedIds: [idOf("Route 1"), id, idOf("Route 2")],
		});
		expect(runNames().slice(0, 4)).toEqual([
			"Starter",
			"Route 1",
			"Brock",
			"Route 2",
		]);
	});

	it("lets a battle share a location's name but not another battle's", () => {
		const { db } = setup();
		addGameLocation(db, { gameId: FIRERED, name: "Brock" });
		addGameBattle(db, brock);
		expect(() => addGameBattle(db, brock)).toThrow(/already exists/);
	});

	it("sets a level cap only on battles", () => {
		const { db, idOf } = setup();
		const { id } = addGameBattle(db, brock);
		setBattleLevelCap(db, { locationId: id, levelCap: null });
		expect(idOf("Brock")).toBe(id);
		expect(
			listGameLocations(db, FIRERED).find((l) => l.id === id)?.levelCap,
		).toBeNull();
		expect(() =>
			setBattleLevelCap(db, { locationId: idOf("Route 1"), levelCap: 5 }),
		).toThrow(/Only battles/);
	});

	it("refuses to delete a battle a run has completed", () => {
		const { db, runId } = setup();
		const { id } = addGameBattle(db, brock);
		setBattleCompleted(db, { runId, locationId: id, completed: true });
		expect(() => deleteGameLocation(db, { locationId: id })).toThrow(
			/completed this battle/,
		);
		setBattleCompleted(db, { runId, locationId: id, completed: false });
		deleteGameLocation(db, { locationId: id });
		expect(listGameLocations(db, FIRERED).some((l) => l.id === id)).toBe(false);
	});

	it("counts completions and encounters separately", () => {
		const { db, idOf, runId } = setup();
		const other = createRun(db, { name: "Other", gameId: FIRERED, rules: "" });
		const { id } = addGameBattle(db, brock);
		for (const r of [runId, other.id]) {
			setBattleCompleted(db, { runId: r, locationId: id, completed: true });
			saveEncounter(db, {
				runId: r,
				locationId: idOf("Route 1"),
				speciesId: null,
				nickname: "",
				outcome: "missed",
			});
		}
		const rows = listGameLocations(db, FIRERED);
		const row = (n: string) => rows.find((l) => l.locationName === n);
		expect(row("Brock")?.completionCount).toBe(2);
		expect(row("Brock")?.encounterCount).toBe(0);
		expect(row("Route 1")?.encounterCount).toBe(2);
		expect(row("Route 1")?.completionCount).toBe(0);
	});

	it("keeps battles when reference data is reseeded", () => {
		const { db, runNames } = setup();
		addGameBattle(db, brock);
		seedRefdata(db, writePokedata());
		expect(runNames()).toContain("Brock");
		expect(
			listGameLocations(db, FIRERED).find((l) => l.locationName === "Brock")
				?.levelCap,
		).toBe(14);
	});
});
