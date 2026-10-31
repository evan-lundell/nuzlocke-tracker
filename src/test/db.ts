import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openDb } from "#/db/client.server";
import { seedRefdata } from "#/db/seed-refdata.server";

export const fixture = {
	games: [
		{
			id: 10,
			slug: "firered",
			name: "FireRed",
			generation: 3,
			versionGroup: "firered-leafgreen",
		},
		{
			id: 11,
			slug: "leafgreen",
			name: "LeafGreen",
			generation: 3,
			versionGroup: "firered-leafgreen",
		},
	],
	species: [
		{ id: 1, slug: "bulbasaur", name: "Bulbasaur", types: ["grass", "poison"] },
		{ id: 16, slug: "pidgey", name: "Pidgey", types: ["normal", "flying"] },
		{ id: 19, slug: "rattata", name: "Rattata", types: ["normal"] },
	],
	locations: [
		{ slug: "kanto-route-1", name: "Route 1", games: ["firered", "leafgreen"] },
		{ slug: "kanto-route-2", name: "Route 2", games: ["firered", "leafgreen"] },
		{ slug: "viridian-forest", name: "Viridian Forest", games: ["firered"] },
		{ slug: "berry-forest", name: "berry Forest", games: ["firered"] },
	],
};

/** Writes the fixture to a temp pokedata dir. */
export function writePokedata() {
	const dir = mkdtempSync(path.join(tmpdir(), "pokedata-"));
	for (const [name, rows] of Object.entries(fixture)) {
		writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(rows));
	}
	return dir;
}

export function testDb() {
	const db = openDb(":memory:");
	seedRefdata(db, writePokedata());
	return db;
}
