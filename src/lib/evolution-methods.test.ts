import { describe, expect, it } from "vitest";
import type { EvolutionMethod } from "#/db/schema";
import { formatEvolutionMethod, methodsForGame } from "./evolution-methods";

const m = (
	versionGroup: string,
	versionGroupOrder: number,
	rest: Partial<EvolutionMethod> = {},
): EvolutionMethod => ({
	versionGroup,
	versionGroupName: versionGroup,
	versionGroupOrder,
	generation: null,
	trigger: "level-up",
	...rest,
});

const game = (
	versionGroup: string,
	versionGroupOrder: number,
	regions: string[],
) => ({ versionGroup, versionGroupOrder, regions });

// Trimmed from PokeAPI's Leafeon data
const leafeon = [
	m("diamond-pearl", 12, {
		location: "eterna-forest",
		locationRegion: "sinnoh",
	}),
	m("black-white", 15, {
		location: "pinwheel-forest",
		locationRegion: "unova",
	}),
	m("sun-moon", 19, { location: "lush-jungle", locationRegion: "alola" }),
	m("sword-shield", 22, { trigger: "use-item", item: "leaf-stone" }),
];

describe("methodsForGame", () => {
	it("uses the game's own methods when PokeAPI has them", () => {
		expect(
			methodsForGame(leafeon, game("sword-shield", 22, ["galar"])),
		).toEqual({ methods: [leafeon[3]], varies: false });
		// X/Y's affection method doesn't carry into Sword/Shield
		const sylveon = [
			m("x-y", 17, { knownMoveType: "fairy", minAffection: 2 }),
			m("sword-shield", 22, { knownMoveType: "fairy", minHappiness: 160 }),
		];
		expect(
			methodsForGame(sylveon, game("sword-shield", 22, ["galar"])).methods,
		).toEqual([sylveon[1]]);
	});

	it("borrows earlier methods for the game's region", () => {
		expect(methodsForGame(leafeon, game("platinum", 13, ["sinnoh"]))).toEqual({
			methods: [leafeon[0]],
			varies: false,
		});
		expect(
			methodsForGame(leafeon, game("ultra-sun-ultra-moon", 20, ["alola"]))
				.methods,
		).toEqual([leafeon[2]]);
	});

	it("drops locations from other regions in the same generation", () => {
		// HeartGold is gen 4 like Diamond, but Eterna Forest isn't in Johto
		expect(
			methodsForGame(
				leafeon,
				game("heartgold-soulsilver", 14, ["kanto", "johto"]),
			).methods,
		).toEqual([]);
	});

	it("drops methods for regional forms elsewhere", () => {
		const marowak = [
			m("red-blue", 3, { minLevel: 28 }),
			m("sun-moon", 19, { minLevel: 28, region: "alola", timeOfDay: "night" }),
		];
		expect(
			methodsForGame(
				marowak,
				game("brilliant-diamond-shining-pearl", 25, ["sinnoh"]),
			),
		).toEqual({ methods: [marowak[0]], varies: false });
	});

	it("labels borrowed methods that disagree", () => {
		expect(
			methodsForGame(
				leafeon,
				game("brilliant-diamond-shining-pearl", 25, ["sinnoh"]),
			),
		).toEqual({ methods: [leafeon[0], leafeon[3]], varies: true });
	});

	it("doesn't carry side-game methods into other games", () => {
		const kleavor = [
			m("legends-arceus", 26, { trigger: "use-item", item: "black-augurite" }),
		];
		expect(
			methodsForGame(kleavor, game("scarlet-violet", 27, ["paldea"])).methods,
		).toEqual([]);
		expect(
			methodsForGame(kleavor, game("legends-arceus", 26, ["hisui"])).methods,
		).toEqual(kleavor);
	});

	it("is empty before the evolution existed", () => {
		const crobat = [m("gold-silver", 5, { minHappiness: 160 })];
		expect(
			methodsForGame(crobat, game("red-blue", 3, ["kanto"])).methods,
		).toEqual([]);
		expect(
			methodsForGame(crobat, game("firered-leafgreen", 11, ["kanto"])).methods,
		).toEqual(crobat);
	});

	it("keeps several methods from the same game", () => {
		const magnezone = [
			m("sun-moon", 19, {
				location: "blush-mountain",
				locationRegion: "alola",
			}),
			m("sun-moon", 19, {
				location: "vast-poni-canyon",
				locationRegion: "alola",
			}),
		];
		expect(methodsForGame(magnezone, game("sun-moon", 19, ["alola"]))).toEqual({
			methods: magnezone,
			varies: false,
		});
	});

	it("lists a method restated in several games once", () => {
		const silcoon = [
			m("ruby-sapphire", 7, { minLevel: 7 }),
			m("x-y", 17, { minLevel: 7 }),
		];
		expect(methodsForGame(silcoon, game("sun-moon", 19, ["alola"]))).toEqual({
			methods: [silcoon[1]],
			varies: false,
		});
	});

	it("doesn't filter by region when the game's regions are unknown", () => {
		const raichu = [
			m("sun-moon", 19, {
				trigger: "use-item",
				item: "thunder-stone",
				region: "alola",
			}),
		];
		expect(methodsForGame(raichu, game("legends-za", 30, [])).methods).toEqual(
			raichu,
		);
	});
});

describe("formatEvolutionMethod", () => {
	const f = (rest: Partial<EvolutionMethod>) =>
		formatEvolutionMethod(m("red-blue", 3, rest));

	it("describes common methods", () => {
		expect(f({ minLevel: 16 })).toBe("Level 16");
		expect(f({ trigger: "use-item", item: "thunder-stone" })).toBe(
			"Use Thunder Stone",
		);
		expect(f({ trigger: "trade" })).toBe("Trade");
		expect(f({ trigger: "trade", heldItem: "metal-coat" })).toBe(
			"Trade holding Metal Coat",
		);
		expect(f({ minHappiness: 160, timeOfDay: "night" })).toBe(
			"Level up with high friendship at night",
		);
		expect(f({ minHappiness: 160, timeOfDay: "day" })).toBe(
			"Level up with high friendship during the day",
		);
	});

	it("includes extra conditions", () => {
		expect(f({ minLevel: 20, relativePhysicalStats: 1 })).toBe(
			"Level 20 with Attack > Defense",
		);
		expect(f({ trigger: "use-item", item: "dawn-stone", gender: "male" })).toBe(
			"Use Dawn Stone (male only)",
		);
		expect(f({ location: "eterna-forest" })).toBe("Level up at Eterna Forest");
		expect(f({ minLevel: 28, timeOfDay: "night", region: "alola" })).toBe(
			"Level 28 at night (in Alola)",
		);
	});

	it("names the move for move-based triggers", () => {
		expect(
			f({ trigger: "use-move", usedMove: "rage-fist", minMoveCount: 20 }),
		).toBe("Use Rage Fist 20 times");
		expect(
			f({
				trigger: "agile-style-move",
				usedMove: "psyshield-bash",
				minMoveCount: 20,
			}),
		).toBe("Use Psyshield Bash in agile style 20 times");
	});

	it("doesn't repeat conditions the trigger text already covers", () => {
		expect(
			f({ trigger: "take-damage", location: "dusty-bowl", minDamageTaken: 49 }),
		).toBe("Walk under the stone arch at Dusty Bowl after losing 49+ HP");
		expect(
			f({ trigger: "spin", heldItem: "strawberry-sweet", timeOfDay: "day" }),
		).toBe("Spin around holding Strawberry Sweet during the day");
	});

	it("falls back to the trigger name", () => {
		expect(f({ trigger: "some-new-trigger" })).toBe("Some New Trigger");
	});
});
