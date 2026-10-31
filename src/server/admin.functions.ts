import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "#/db/client.server";
import {
	addGameLocation,
	deleteGameLocation,
	listGameLocations,
	renameLocation,
	setLocationHidden,
	setLocationOrder,
} from "./admin.server";

const id = z.number().int();
const name = z.string().trim().min(1, "Name is required").max(100);

export const getGameLocationsFn = createServerFn()
	.validator(z.object({ gameId: id }))
	.handler(({ data }) => listGameLocations(getDb(), data.gameId));

export const setLocationOrderFn = createServerFn({ method: "POST" })
	.validator(z.object({ gameId: id, orderedIds: z.array(id) }))
	.handler(({ data }) => setLocationOrder(getDb(), data));

export const setLocationHiddenFn = createServerFn({ method: "POST" })
	.validator(z.object({ locationId: id, hidden: z.boolean() }))
	.handler(({ data }) => setLocationHidden(getDb(), data));

export const renameLocationFn = createServerFn({ method: "POST" })
	.validator(z.object({ locationId: id, name }))
	.handler(({ data }) => renameLocation(getDb(), data));

export const addGameLocationFn = createServerFn({ method: "POST" })
	.validator(z.object({ gameId: id, name }))
	.handler(({ data }) => addGameLocation(getDb(), data));

export const deleteGameLocationFn = createServerFn({ method: "POST" })
	.validator(z.object({ locationId: id }))
	.handler(({ data }) => deleteGameLocation(getDb(), data));
