import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "#/db/client.server";
import { runStatuses } from "#/db/schema";
import {
	createRun,
	deleteRun,
	getRun,
	listRuns,
	updateRun,
} from "./runs.server";

const runId = z.object({ id: z.number().int() });

export const getRunsFn = createServerFn().handler(() => listRuns(getDb()));

export const getRunFn = createServerFn()
	.validator(runId)
	.handler(({ data }) => {
		const run = getRun(getDb(), data.id);
		if (!run) throw notFound();
		return run;
	});

export const createRunFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			name: z.string().trim().min(1, "Name is required").max(100),
			gameId: z.number().int(),
			rules: z.string().max(5000),
		}),
	)
	.handler(({ data }) => createRun(getDb(), data));

export const updateRunFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			id: z.number().int(),
			name: z.string().trim().min(1).max(100).optional(),
			rules: z.string().max(5000).optional(),
			status: z.enum(runStatuses).optional(),
		}),
	)
	.handler(({ data }) => updateRun(getDb(), data));

export const deleteRunFn = createServerFn({ method: "POST" })
	.validator(runId)
	.handler(({ data }) => deleteRun(getDb(), data.id));
