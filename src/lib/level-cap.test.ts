import { describe, expect, it } from "vitest";
import { currentLevelCap, parseLevelCap } from "./level-cap";

const battle = (
	locationName: string,
	levelCap: number | null,
	completedAt: Date | null = null,
) => ({ kind: "battle", locationName, levelCap, completedAt });
const done = new Date(0);

describe("parseLevelCap", () => {
	it("treats blank as no cap and rejects values out of range", () => {
		expect(parseLevelCap("")).toBeNull();
		expect(parseLevelCap("1")).toBe(1);
		expect(parseLevelCap("100")).toBe(100);
		expect(parseLevelCap("0")).toBeUndefined();
		expect(parseLevelCap("101")).toBeUndefined();
	});
});

describe("currentLevelCap", () => {
	it("is the first incomplete battle in order", () => {
		expect(
			currentLevelCap([
				{ ...battle("Route 1", null), kind: "location" },
				battle("Brock", 14, done),
				battle("Misty", 21),
				battle("Surge", 24),
			]),
		).toEqual({ name: "Misty", levelCap: 21 });
	});

	it("skips battles without a cap", () => {
		expect(
			currentLevelCap([battle("Rival", null), battle("Brock", 14)]),
		).toEqual({ name: "Brock", levelCap: 14 });
	});

	it("uses the earliest incomplete battle after out-of-order completion", () => {
		expect(
			currentLevelCap([battle("Brock", 14), battle("Misty", 21, done)]),
		).toEqual({ name: "Brock", levelCap: 14 });
	});

	it("is null when everything is complete or there are no battles", () => {
		expect(currentLevelCap([battle("Brock", 14, done)])).toBeNull();
		expect(currentLevelCap([])).toBeNull();
	});
});
