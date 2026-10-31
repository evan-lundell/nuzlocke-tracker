/**
 * Maps each species id to the id of its line's base form, following
 * evolvesFromId upward. Branching lines (Eevee) and babies (Pichu) share a root.
 */
export function buildLineRoots(
	species: { id: number; evolvesFromId: number | null }[],
): Map<number, number> {
	const parent = new Map(species.map((s) => [s.id, s.evolvesFromId]));
	const roots = new Map<number, number>();
	for (const { id } of species) {
		let root = id;
		const seen = new Set<number>();
		while (!seen.has(root)) {
			seen.add(root);
			const up = parent.get(root);
			if (up == null || !parent.has(up)) break;
			root = up;
		}
		roots.set(id, root);
	}
	return roots;
}

type EncounterLike = {
	locationId: number;
	locationName: string;
	speciesId: number | null;
	speciesName: string | null;
	outcome: string | null;
};

/**
 * Line roots already caught in the run, mapped to a short reason
 * ("Pidgey on Route 1"). Skips the encounter at excludeLocationId so a row's
 * own catch doesn't count against itself.
 */
export function caughtLines(
	rows: EncounterLike[],
	roots: Map<number, number>,
	excludeLocationId?: number,
): Map<number, string> {
	const lines = new Map<number, string>();
	for (const r of rows) {
		if (r.outcome !== "caught" || r.speciesId == null) continue;
		if (r.locationId === excludeLocationId) continue;
		const root = roots.get(r.speciesId) ?? r.speciesId;
		if (!lines.has(root)) {
			lines.set(root, `${r.speciesName ?? "Caught"} on ${r.locationName}`);
		}
	}
	return lines;
}
