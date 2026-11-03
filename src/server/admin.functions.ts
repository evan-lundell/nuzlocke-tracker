import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "#/db/client.server";
import {
	addGameBattle,
	addGameLocation,
	deleteGameLocation,
	listGameLocations,
	renameLocation,
	setBattleLevelCap,
	setLocationHidden,
	setLocationOrder,
} from "./admin.server";

const id = z.number().int();
const name = z.string().trim().min(1, "Name is required").max(100);
const levelCap = z
	.number()
	.int()
	.min(1, "Level cap must be 1-100")
	.max(100, "Level cap must be 1-100")
	.nullable();

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

export const addGameBattleFn = createServerFn({ method: "POST" })
	.validator(z.object({ gameId: id, name, levelCap }))
	.handler(({ data }) => addGameBattle(getDb(), data));

export const setBattleLevelCapFn = createServerFn({ method: "POST" })
	.validator(z.object({ locationId: id, levelCap }))
	.handler(({ data }) => setBattleLevelCap(getDb(), data));

export const deleteGameLocationFn = createServerFn({ method: "POST" })
	.validator(z.object({ locationId: id }))
	.handler(({ data }) => deleteGameLocation(getDb(), data));
