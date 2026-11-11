import Anthropic from "@anthropic-ai/sdk";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "#/db/client.server";
import { listCaught, listRunLocations } from "./encounters.server";
import {
	maxNicknameLength,
	nicknamesEnabled,
	suggestNicknames,
} from "./nicknames.server";
import { getRun } from "./runs.server";

// Cached on globalThis so dev-server HMR doesn't build a new client per reload
const globalForClient = globalThis as unknown as { __anthropic?: Anthropic };

function getClient() {
	globalForClient.__anthropic ??= new Anthropic();
	return globalForClient.__anthropic;
}

export const getNicknameFeatureFn = createServerFn().handler(() => ({
	enabled: nicknamesEnabled(),
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
		if (!nicknamesEnabled()) {
			throw new Error("Nickname suggestions aren't set up on this server");
		}
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

		return suggestNicknames(getClient(), {
			speciesName: row.speciesName,
			types: row.speciesTypes ?? [],
			locationName: row.locationName,
			gameName: run.gameName,
			maxLength: maxNicknameLength(run.generation),
			takenNicknames,
			theme: data.theme || undefined,
		});
	});
