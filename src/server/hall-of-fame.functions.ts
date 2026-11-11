import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "#/db/client.server";
import {
	enterHallOfFame,
	getHallOfFame,
	removeHallOfFame,
} from "./hall-of-fame.server";

const runId = z.object({ runId: z.number().int() });

export const getHallOfFameFn = createServerFn()
	.validator(runId)
	.handler(({ data }) => getHallOfFame(getDb(), data.runId));

export const enterHallOfFameFn = createServerFn({ method: "POST" })
	.validator(runId)
	.handler(({ data }) => enterHallOfFame(getDb(), data.runId));

export const removeHallOfFameFn = createServerFn({ method: "POST" })
	.validator(runId)
	.handler(({ data }) => removeHallOfFame(getDb(), data.runId));
