import { describe, expect, it } from "vitest";
import { testDb } from "#/test/db";
import { addGameBattle } from "./admin.server";
import {
	evolvePokemon,
	listRunLocations,
	saveEncounter,
	setBattleCompleted,
	setPokemonState,
} from "./encounters.server";
import {
	enterHallOfFame,
	getHallOfFame,
	removeHallOfFame,
} from "./hall-of-fame.server";
import { createRun, deleteRun, getRun } from "./runs.server";

const FIRERED = 10;

function setup() {
	const db = testDb();
	const { id: runId } = createRun(db, {
		name: "Test",
		gameId: FIRERED,
		rules: "",
	});
	const loc = (name: string) => {
		const l = listRunLocations(db, runId).find((x) => x.locationName === name);
		if (!l) throw new Error(`no location ${name}`);
		return l.locationId;
	};
	const encounterAt = (name: string) => {
		const id = listRunLocations(db, runId).find(
			(x) => x.locationName === name,
		)?.encounterId;
		if (!id) throw new Error(`no encounter at ${name}`);
		return id;
	};
	// new catches land in the box, so move them to the party
	const catchMon = (location: string, speciesId: number, nickname: string) => {
		saveEncounter(db, {
			runId,
			locationId: loc(location),
			speciesId,
			nickname,
			outcome: "caught",
		});
		setPokemonState(db, {
			encounterId: encounterAt(location),
			state: "party",
			causeOfDeath: "",
		});
	};
	return { db, runId, loc, catchMon, encounterAt };
}

describe("hall of fame", () => {
	it("refuses an empty party", () => {
		const { db, runId } = setup();
		expect(() => enterHallOfFame(db, runId)).toThrow(/party is empty/);
		expect(getHallOfFame(db, runId)).toBeNull();
	});

	it("snapshots the party, counts, and completes the run", () => {
		const { db, runId, loc, catchMon, encounterAt } = setup();
		catchMon("Route 1", 16, "Birdie");
		catchMon("Route 2", 129, "Splash");
		catchMon("Viridian Forest", 19, "Rat");
		setPokemonState(db, {
			encounterId: encounterAt("Viridian Forest"),
			state: "dead",
			causeOfDeath: "Brock",
		});
		addGameBattle(db, { gameId: FIRERED, name: "Brock", levelCap: 14 });
		setBattleCompleted(db, {
			runId,
			locationId: loc("Brock"),
			completed: true,
		});

		const entry = enterHallOfFame(db, runId);
		expect(entry.members).toEqual([
			{
				speciesId: 16,
				speciesName: "Pidgey",
				nickname: "Birdie",
				types: ["normal", "flying"],
				metAt: "Route 1",
			},
			{
				speciesId: 129,
				speciesName: "Magikarp",
				nickname: "Splash",
				types: ["water"],
				metAt: "Route 2",
			},
		]);
		expect(entry.battlesWon).toBe(1);
		expect(entry.deaths).toBe(1);
		expect(getRun(db, runId)?.status).toBe("completed");
	});

	it("stays frozen until re-entered", () => {
		const { db, runId, catchMon, encounterAt } = setup();
		catchMon("Route 2", 129, "Splash");
		enterHallOfFame(db, runId);
		evolvePokemon(db, {
			encounterId: encounterAt("Route 2"),
			speciesId: 130,
			ruleType: null,
		});
		expect(getHallOfFame(db, runId)?.members[0]?.speciesName).toBe("Magikarp");

		enterHallOfFame(db, runId);
		expect(getHallOfFame(db, runId)?.members[0]?.speciesName).toBe("Gyarados");
	});

	it("can be removed, and goes away with its run", () => {
		const { db, runId, catchMon } = setup();
		catchMon("Route 1", 16, "Birdie");
		enterHallOfFame(db, runId);
		removeHallOfFame(db, runId);
		expect(getHallOfFame(db, runId)).toBeNull();

		enterHallOfFame(db, runId);
		deleteRun(db, runId);
		expect(getHallOfFame(db, runId)).toBeNull();
	});
});
