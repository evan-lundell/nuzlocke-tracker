import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const NICKNAME_MODEL = "claude-opus-5-5";
export const SUGGESTION_COUNT = 5;
// Gen 6+ allow 12 characters; older games allow 10
export const MAX_NICKNAME_LENGTH = 12;

export type NicknameRequest = {
	speciesName: string;
	types: string[];
	locationName: string;
	gameName: string;
	takenNicknames: string[];
	theme?: string;
};

/** The slice of the SDK client this module uses, so tests can pass a fake. */
export type NicknameClient = {
	beta: { messages: Pick<Anthropic["beta"]["messages"], "parse"> };
};

const SYSTEM = `You suggest nicknames for Pokémon caught during a Nuzlocke run. Nuzlocke players get attached to their team, so good nicknames are memorable and fun: puns on the species, nods to its types or where it was caught, or names that just suit its personality.

Rules:
- Suggest exactly ${SUGGESTION_COUNT} nicknames, each a different style.
- Each must be at most ${MAX_NICKNAME_LENGTH} characters including spaces. Shorter is better; older games only allow 10.
- Don't reuse any name the player already has on this run.
- Don't just use the species name.
- If the player gives a theme, every suggestion should fit it.`;

const Suggestions = z.object({ nicknames: z.array(z.string()) });

export function buildPrompt(input: NicknameRequest) {
	const lines = [
		`Pokémon: ${input.speciesName} (${input.types.join("/")} type)`,
		`Caught at: ${input.locationName}`,
		`Game: ${input.gameName}`,
		input.takenNicknames.length > 0
			? `Names already used on this run: ${input.takenNicknames.join(", ")}`
			: "No nicknames used on this run yet.",
	];
	if (input.theme) lines.push(`Theme: ${input.theme}`);
	return lines.join("\n");
}

/** Trims, drops unusable or repeated names, and caps the list. */
export function cleanSuggestions(names: string[], taken: string[]) {
	const seen = new Set(taken.map((n) => n.trim().toLowerCase()));
	const out: string[] = [];
	for (const raw of names) {
		const name = raw.trim();
		const key = name.toLowerCase();
		if (!name || name.length > MAX_NICKNAME_LENGTH || seen.has(key)) continue;
		seen.add(key);
		out.push(name);
		if (out.length === SUGGESTION_COUNT) break;
	}
	return out;
}

export async function suggestNicknames(
	client: NicknameClient,
	input: NicknameRequest,
) {
	const response = await client.beta.messages.parse({
		model: NICKNAME_MODEL,
		max_tokens: 2000,
		// fall back to another model if this one declines the request
		betas: ["server-side-fallback-2026-07-01"],
		fallbacks: "default",
		output_config: {
			effort: "low",
			format: betaZodOutputFormat(Suggestions),
		},
		system: SYSTEM,
		messages: [{ role: "user", content: buildPrompt(input) }],
	});

	if (response.stop_reason === "refusal" || !response.parsed_output) {
		throw new Error("Couldn't come up with nicknames this time. Try again.");
	}
	const names = cleanSuggestions(
		response.parsed_output.nicknames,
		input.takenNicknames,
	);
	if (names.length === 0) {
		throw new Error("Couldn't come up with nicknames this time. Try again.");
	}
	return names;
}

export function nicknamesEnabled(env: NodeJS.ProcessEnv = process.env) {
	return Boolean(env.ANTHROPIC_API_KEY);
}
