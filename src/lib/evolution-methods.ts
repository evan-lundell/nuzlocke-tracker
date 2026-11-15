import type { EvolutionMethod } from "#/db/schema";

type GameVersion = {
	versionGroup: string;
	versionGroupOrder: number;
	regions: string[];
};

/**
 * Side games with their own evolution mechanics (agile/strong-style moves,
 * Let's Go's lack of trading items). Their methods only count in that game,
 * never in later main-series games.
 */
const SELF_CONTAINED_GROUPS = new Set([
	"lets-go-pikachu-lets-go-eevee",
	"legends-arceus",
	"legends-za",
]);

export type GameEvolution = {
	methods: EvolutionMethod[];
	// methods were borrowed from other games and disagree, so label each
	varies: boolean;
};

/**
 * The ways to evolve in a game. PokeAPI lists each method under the version
 * group that introduced or changed it, with no end date, so:
 * - when the game has its own entries, those are the answer
 * - otherwise earlier games' methods are used, minus self-contained side
 *   games and methods tied to a region the game isn't set in (Moss Rock
 *   locations, Alolan forms). If more than one is left, `varies` is set so the
 *   UI can say which game each came from rather than guess
 * Empty means the evolution isn't possible in that game (Crobat in Red).
 */
export function methodsForGame(
	methods: EvolutionMethod[],
	game: GameVersion,
): GameEvolution {
	// An unknown region list (Legends: Z-A) filters nothing
	const inRegion = (region?: string) =>
		!region || game.regions.length === 0 || game.regions.includes(region);
	const usable = methods.filter(
		(m) => inRegion(m.region) && inRegion(m.locationRegion),
	);

	const own = usable.filter((m) => m.versionGroup === game.versionGroup);
	if (own.length) return { methods: own, varies: false };

	const borrowed = usable.filter(
		(m) =>
			m.versionGroupOrder <= game.versionGroupOrder &&
			!SELF_CONTAINED_GROUPS.has(m.versionGroup ?? ""),
	);
	// The same conditions restated in several games only need listing once
	const latest = new Map<string, EvolutionMethod>();
	for (const m of borrowed) {
		const key = formatEvolutionMethod(m);
		const prev = latest.get(key);
		if (!prev || m.versionGroupOrder > prev.versionGroupOrder)
			latest.set(key, m);
	}
	const result = [...latest.values()];
	return { methods: result, varies: result.length > 1 };
}

/** "thunder-stone" -> "Thunder Stone" */
export const humanize = (slug: string) =>
	slug
		.split("-")
		.map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
		.join(" ");

// Triggers whose fields don't already say what to do
const TRIGGERS: Record<string, string> = {
	"level-up": "Level up",
	"in-battle-level-up": "Level up in battle",
	trade: "Trade",
	shed: "Level 20 with an empty party slot and a spare Poké Ball",
	spin: "Spin around",
	"tower-of-darkness": "Train in the Tower of Darkness",
	"tower-of-waters": "Train in the Tower of Waters",
	"three-critical-hits": "Land three critical hits in one battle",
	"take-damage": "Walk under the stone arch",
	"recoil-damage": "Take recoil damage without fainting",
	"three-defeated-bisharp": "Defeat three Bisharp leading Pawniard",
	"gimmighoul-coins": "Collect 999 Gimmighoul Coins",
	"meltan-candies": "Feed 400 Meltan Candies",
};

const MOVE_STYLE: Record<string, string> = {
	"agile-style-move": " in agile style",
	"strong-style-move": " in strong style",
};

/** One method as a sentence fragment, e.g. "Level 16" or "Trade holding Metal Coat". */
export function formatEvolutionMethod(m: EvolutionMethod): string {
	const levelUp = m.trigger.endsWith("level-up");
	let base: string;
	if (m.trigger === "use-item" && m.item) base = `Use ${humanize(m.item)}`;
	else if (m.usedMove) {
		base = `Use ${humanize(m.usedMove)}${MOVE_STYLE[m.trigger] ?? ""}`;
		if (m.minMoveCount) base += ` ${m.minMoveCount} times`;
	} else if (m.minLevel && levelUp) base = `Level ${m.minLevel}`;
	else base = TRIGGERS[m.trigger] ?? humanize(m.trigger);

	const parts = [base];
	if (m.minLevel && !levelUp) parts.push(`from level ${m.minLevel}`);
	if (m.heldItem) parts.push(`holding ${humanize(m.heldItem)}`);
	if (m.tradeSpecies) parts.push(`for ${humanize(m.tradeSpecies)}`);
	if (m.minHappiness) parts.push("with high friendship");
	if (m.minAffection) parts.push("with high affection");
	if (m.minBeauty) parts.push("with high Beauty");
	if (m.knownMove) parts.push(`knowing ${humanize(m.knownMove)}`);
	if (m.knownMoveType)
		parts.push(`knowing a ${humanize(m.knownMoveType)}-type move`);
	if (m.relativePhysicalStats === 1) parts.push("with Attack > Defense");
	if (m.relativePhysicalStats === -1) parts.push("with Attack < Defense");
	if (m.relativePhysicalStats === 0) parts.push("with Attack = Defense");
	if (m.partySpecies)
		parts.push(`with ${humanize(m.partySpecies)} in the party`);
	if (m.partyType)
		parts.push(`with a ${humanize(m.partyType)}-type in the party`);
	if (m.location) parts.push(`at ${humanize(m.location)}`);
	if (m.timeOfDay)
		parts.push(
			m.timeOfDay === "day"
				? "during the day"
				: `at ${m.timeOfDay.replaceAll("-", " ")}`,
		);
	if (m.needsOverworldRain) parts.push("in the rain");
	if (m.turnUpsideDown) parts.push("holding the console upside down");
	if (m.minSteps) parts.push(`after walking ${m.minSteps} steps`);
	if (m.minDamageTaken) parts.push(`after losing ${m.minDamageTaken}+ HP`);
	if (m.gender) parts.push(`(${m.gender} only)`);
	if (m.region) parts.push(`(in ${humanize(m.region)})`);
	return parts.join(" ");
}
