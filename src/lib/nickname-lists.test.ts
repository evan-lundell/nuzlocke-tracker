import { describe, expect, it } from "vitest";
import { pickListNicknames, THEME_NAMES, TYPE_NAMES } from "./nickname-lists";

const pick = (opts: Partial<Parameters<typeof pickListNicknames>[0]>) =>
	pickListNicknames({
		types: ["fire"],
		takenNicknames: [],
		maxLength: 12,
		...opts,
	});

describe("nickname lists", () => {
	it("has names for every type", () => {
		const types = [
			"normal",
			"fire",
			"water",
			"electric",
			"grass",
			"ice",
			"fighting",
			"poison",
			"ground",
			"flying",
			"psychic",
			"bug",
			"rock",
			"ghost",
			"dragon",
			"dark",
			"steel",
			"fairy",
		];
		for (const t of types) expect(TYPE_NAMES[t]?.length).toBeGreaterThan(10);
	});

	it("keeps names short enough for at least the newer games", () => {
		const all = [
			...Object.values(TYPE_NAMES).flat(),
			...Object.values(THEME_NAMES).flat(),
		];
		for (const n of all) expect([...n].length).toBeLessThanOrEqual(12);
	});
});

describe("pickListNicknames", () => {
	it("picks five names from the Pokémon's types", () => {
		const names = pick({ types: ["fire", "flying"] });
		expect(names).toHaveLength(5);
		const pool = [...TYPE_NAMES.fire, ...TYPE_NAMES.flying];
		for (const n of names) expect(pool).toContain(n);
		expect(new Set(names).size).toBe(5);
	});

	it("uses the theme instead of types when one is given", () => {
		for (const n of pick({ theme: "Mythology" })) {
			expect(THEME_NAMES.Mythology).toContain(n);
		}
	});

	it("falls back to types for an unknown theme", () => {
		for (const n of pick({ theme: "Nonsense" })) {
			expect(TYPE_NAMES.fire).toContain(n);
		}
	});

	it("skips taken names (ignoring case) and names over the limit", () => {
		const taken = TYPE_NAMES.fire.filter(
			(n) => n !== "Ember" && n !== "Inferno",
		);
		expect(
			pick({ takenNicknames: taken.map((n) => n.toUpperCase()) }).sort(),
		).toEqual(["Ember", "Inferno"]);
		expect(pick({ takenNicknames: taken, maxLength: 5 })).toEqual(["Ember"]);
	});

	it("shuffles with the given random source", () => {
		const first = pick({ random: () => 0 });
		const second = pick({ random: () => 0.99 });
		expect(first).not.toEqual(second);
	});

	it("returns nothing for a typeless Pokémon with no theme", () => {
		expect(pick({ types: [] })).toEqual([]);
	});
});
