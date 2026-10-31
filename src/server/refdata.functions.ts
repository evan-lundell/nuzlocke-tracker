import { createServerFn } from "@tanstack/react-start";
import { getDb } from "#/db/client.server";
import { listGames, listSpecies } from "./refdata.server";

export const getGamesFn = createServerFn().handler(() => listGames(getDb()));

export const getSpeciesFn = createServerFn().handler(() =>
	listSpecies(getDb()),
);
