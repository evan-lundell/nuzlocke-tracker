import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "#/db/client.server";
import { encounterOutcomes, pokemonStates } from "#/db/schema";
import {
	addCustomLocation,
	clearEncounter,
	deleteCustomLocation,
	evolvePokemon,
	listCaught,
	listRunLocations,
	saveEncounter,
	setPokemonState,
} from "./encounters.server";

const id = z.number().int();
const runLocation = z.object({ runId: id, locationId: id });

export const getRunLocationsFn = createServerFn()
	.validator(z.object({ runId: id }))
	.handler(({ data }) => listRunLocations(getDb(), data.runId));

export const getCaughtFn = createServerFn()
	.validator(z.object({ runId: id }))
	.handler(({ data }) => listCaught(getDb(), data.runId));

export const saveEncounterFn = createServerFn({ method: "POST" })
	.validator(
		runLocation.extend({
			speciesId: id.nullable(),
			nickname: z.string().trim().max(40),
			outcome: z.enum(encounterOutcomes),
			ruleType: z.string().nullable(),
		}),
	)
	.handler(({ data }) => saveEncounter(getDb(), data));

export const clearEncounterFn = createServerFn({ method: "POST" })
	.validator(runLocation)
	.handler(({ data }) => clearEncounter(getDb(), data));

export const addCustomLocationFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			runId: id,
			name: z.string().trim().min(1, "Name is required").max(100),
			sortOrder: id.nullable(),
		}),
	)
	.handler(({ data }) => addCustomLocation(getDb(), data));

export const deleteCustomLocationFn = createServerFn({ method: "POST" })
	.validator(runLocation)
	.handler(({ data }) => deleteCustomLocation(getDb(), data));

export const setPokemonStateFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			encounterId: id,
			state: z.enum(pokemonStates),
			causeOfDeath: z.string().trim().max(200),
		}),
	)
	.handler(({ data }) => setPokemonState(getDb(), data));

export const evolvePokemonFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			encounterId: id,
			speciesId: id,
			ruleType: z.string().nullable(),
		}),
	)
	.handler(({ data }) => evolvePokemon(getDb(), data));
