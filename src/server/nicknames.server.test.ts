import { describe, expect, it, vi } from "vitest";
import {
	buildPrompt,
	cleanSuggestions,
	maxNicknameLength,
	type NicknameClient,
	type NicknameRequest,
	nicknamesEnabled,
	suggestNicknames,
} from "./nicknames.server";

const request: NicknameRequest = {
	speciesName: "Charmander",
	types: ["fire"],
	locationName: "Pallet Town",
	gameName: "FireRed",
	maxLength: 10,
	takenNicknames: ["Birdie", "Splash"],
};

function fakeClient(response: {
	stop_reason: string;
	parsed_output: { nicknames: string[] } | null;
}) {
	const parse = vi.fn().mockResolvedValue(response);
	return {
		client: { beta: { messages: { parse } } } as unknown as NicknameClient,
		parse,
	};
}

describe("buildPrompt", () => {
	it("includes the species, types, place, game and taken names", () => {
		const prompt = buildPrompt({
			...request,
			types: ["water", "flying"],
			theme: "Greek gods",
		});
		expect(prompt).toContain("Charmander (water/flying type)");
		expect(prompt).toContain("Pallet Town");
		expect(prompt).toContain(
			"FireRed (nicknames can be at most 10 characters)",
		);
		expect(prompt).toContain("Birdie, Splash");
		expect(prompt).toContain("Theme: Greek gods");
	});

	it("says so when no names are taken and leaves out a missing theme", () => {
		const prompt = buildPrompt({ ...request, takenNicknames: [] });
		expect(prompt).toContain("No nicknames used");
		expect(prompt).not.toContain("Theme");
	});
});

describe("cleanSuggestions", () => {
	it("drops blank, too-long, repeated and taken names", () => {
		expect(
			cleanSuggestions(
				[" Ember ", "", "Ember", "ember", "birdie", "Waytoolongname", "Cinder"],
				["Birdie"],
				12,
			),
		).toEqual(["Ember", "Cinder"]);
	});

	it("applies the game's length limit", () => {
		const names = ["Hephaestus", "Hephaestus2", "Aphrodite12"];
		// 10 chars fits everywhere; 11 only fits gen 6+
		expect(cleanSuggestions(names, [], maxNicknameLength(3))).toEqual([
			"Hephaestus",
		]);
		expect(cleanSuggestions(names, [], maxNicknameLength(8))).toEqual(names);
	});

	it("counts accented letters as one character", () => {
		expect(cleanSuggestions(["Pokémoné123"], [], 11)).toEqual(["Pokémoné123"]);
	});

	it("caps the list at five", () => {
		expect(
			cleanSuggestions(["A", "B", "C", "D", "E", "F", "G"], [], 12),
		).toEqual(["A", "B", "C", "D", "E"]);
	});
});

describe("maxNicknameLength", () => {
	it("is 10 through gen 5 and 12 from gen 6", () => {
		expect(maxNicknameLength(1)).toBe(10);
		expect(maxNicknameLength(5)).toBe(10);
		expect(maxNicknameLength(6)).toBe(12);
		expect(maxNicknameLength(9)).toBe(12);
	});
});

describe("suggestNicknames", () => {
	it("returns cleaned suggestions", async () => {
		const { client, parse } = fakeClient({
			stop_reason: "end_turn",
			parsed_output: { nicknames: ["Ember", "Splash", "Toasty"] },
		});
		await expect(suggestNicknames(client, request)).resolves.toEqual([
			"Ember",
			"Toasty",
		]);
		const params = parse.mock.calls[0]?.[0];
		expect(params.model).toBe("claude-opus-5-5");
		expect(params.messages[0].content).toContain("Charmander");
	});

	it("throws a friendly error on a refusal", async () => {
		const { client } = fakeClient({
			stop_reason: "refusal",
			parsed_output: null,
		});
		await expect(suggestNicknames(client, request)).rejects.toThrow(
			/Try again/,
		);
	});

	it("throws when nothing usable comes back", async () => {
		const { client } = fakeClient({
			stop_reason: "end_turn",
			parsed_output: { nicknames: ["Birdie", ""] },
		});
		await expect(suggestNicknames(client, request)).rejects.toThrow(
			/Try again/,
		);
	});
});

describe("nicknamesEnabled", () => {
	it("follows ANTHROPIC_API_KEY", () => {
		expect(nicknamesEnabled({})).toBe(false);
		expect(nicknamesEnabled({ ANTHROPIC_API_KEY: "" })).toBe(false);
		expect(nicknamesEnabled({ ANTHROPIC_API_KEY: "sk-test" })).toBe(true);
	});
});
