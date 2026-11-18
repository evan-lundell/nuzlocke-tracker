import Anthropic from "@anthropic-ai/sdk";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "#/db/client.server";
import { NICKNAME_THEMES } from "#/lib/nickname-lists";
import { listCaught, listRunLocations } from "./encounters.server";
import {
	maxNicknameLength,
	nicknamesEnabled,
	suggestNicknamesWithFallback,
} from "./nicknames.server";
import { getRun } from "./runs.server";

// Cached on globalThis so dev-server HMR doesn't build a new client per reload
const globalForClient = globalThis as unknown as { __anthropic?: Anthropic };

function getClient() {
	globalForClient.__anthropic ??= new Anthropic();
	return globalForClient.__anthropic;
}

export type NicknameMode = "claude" | "lists";

/** Claude when an API key is set; otherwise the built-in lists. */
export const getNicknameFeatureFn = createServerFn().handler(() => ({
	mode: (nicknamesEnabled() ? "claude" : "lists") as NicknameMode,
	themes: NICKNAME_THEMES,
}));

export const suggestNicknamesFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			runId: z.number().int(),
			locationId: z.number().int(),
			theme: z.string().trim().max(60).optional(),
		}),
	)
	.handler(async ({ data }) => {
		// Everything but the theme comes from the database, not the request
		const db = getDb();
		const run = getRun(db, data.runId);
		if (!run) throw new Error("Run not found");
		const row = listRunLocations(db, data.runId).find(
			(l) => l.locationId === data.locationId,
		);
		if (!row?.speciesName) throw new Error("Pick a Pokémon first");

		const takenNicknames = listCaught(db, data.runId)
			.filter((m) => m.id !== row.encounterId && m.nickname)
			.map((m) => m.nickname);

		return suggestNicknamesWithFallback(
			nicknamesEnabled() ? getClient() : null,
			{
				speciesName: row.speciesName,
				types: row.speciesTypes ?? [],
				locationName: row.locationName,
				gameName: run.gameName,
				maxLength: maxNicknameLength(run.generation),
				takenNicknames,
				theme: data.theme || undefined,
			},
		);
	});
