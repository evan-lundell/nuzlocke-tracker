import { describe, expect, it } from "vitest";
import { seedRefdata } from "#/db/seed-refdata.server";
import { testDb, writePokedata } from "#/test/db";
import {
	addGameLocation,
	deleteGameLocation,
	listGameLocations,
	renameLocation,
	setLocationHidden,
	setLocationOrder,
} from "./admin.server";
import { listRunLocations, saveEncounter } from "./encounters.server";
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
