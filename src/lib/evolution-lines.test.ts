import { describe, expect, it } from "vitest";
import { buildLineRoots, caughtLines } from "./evolution-lines";

const species = [
	{ id: 16, evolvesFromId: null }, // Pidgey
	{ id: 17, evolvesFromId: 16 }, // Pidgeotto
	{ id: 18, evolvesFromId: 17 }, // Pidgeot
	{ id: 133, evolvesFromId: null }, // Eevee
	{ id: 134, evolvesFromId: 133 }, // Vaporeon
	{ id: 135, evolvesFromId: 133 }, // Jolteon
	{ id: 172, evolvesFromId: null }, // Pichu
	{ id: 25, evolvesFromId: 172 }, // Pikachu
	{ id: 26, evolvesFromId: 25 }, // Raichu
	{ id: 999, evolvesFromId: 12345 }, // parent missing from the list
];

describe("buildLineRoots", () => {
	const roots = buildLineRoots(species);

	it("maps every stage of a line to its base form", () => {
		expect([16, 17, 18].map((id) => roots.get(id))).toEqual([16, 16, 16]);
	});

	it("groups branching evolutions under one root", () => {
		expect([133, 134, 135].map((id) => roots.get(id))).toEqual([133, 133, 133]);
	});

	it("includes baby forms in the line", () => {
		expect([172, 25, 26].map((id) => roots.get(id))).toEqual([172, 172, 172]);
	});

	it("treats a species with an unknown parent as its own root", () => {
		expect(roots.get(999)).toBe(999);
	});

	it("survives a cycle", () => {
		const cyclic = buildLineRoots([
			{ id: 1, evolvesFromId: 2 },
			{ id: 2, evolvesFromId: 1 },
		]);
		expect(cyclic.size).toBe(2);
	});
});

describe("caughtLines", () => {
	const roots = buildLineRoots(species);
	const row = (
		locationId: number,
		speciesId: number | null,
		outcome: string | null,
	) => ({
		locationId,
		locationName: `Route ${locationId}`,
		speciesId,
		speciesName: speciesId ? `Mon ${speciesId}` : null,
		outcome,
	});

	it("collects caught lines with a reason", () => {
		const lines = caughtLines([row(1, 17, "caught")], roots);
		expect(lines.get(16)).toBe("Mon 17 on Route 1");
	});

	it("ignores non-caught outcomes and empty rows", () => {
		const lines = caughtLines(
			[
				row(1, 16, "failed"),
				row(2, 133, "missed"),
				row(3, 25, "skipped"),
				row(4, null, null),
			],
			roots,
		);
		expect(lines.size).toBe(0);
	});

	it("skips the excluded location", () => {
		const rows = [row(1, 16, "caught"), row(2, 134, "caught")];
		const lines = caughtLines(rows, roots, 1);
		expect([...lines.keys()]).toEqual([133]);
	});
});
