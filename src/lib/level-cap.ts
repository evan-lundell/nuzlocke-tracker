/** Reads a level cap field: blank is no cap, undefined means it's out of range. */
export function parseLevelCap(value: string) {
	if (!value) return null;
	const cap = Number(value);
	return Number.isInteger(cap) && cap >= 1 && cap <= 100 ? cap : undefined;
}

type BattleLike = {
	kind: string;
	locationName: string;
	levelCap: number | null;
	completedAt: Date | null;
};

/**
 * The cap currently in force: the first battle in the given order that isn't
 * completed and has a cap. Expects rows already sorted in game order.
 */
export function currentLevelCap(rows: BattleLike[]) {
	for (const r of rows) {
		if (r.kind === "battle" && !r.completedAt && r.levelCap !== null) {
			return { name: r.locationName, levelCap: r.levelCap };
		}
	}
	return null;
}
