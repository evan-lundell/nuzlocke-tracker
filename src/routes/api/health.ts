import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";
import { getDb } from "#/db/client.server";
import { appVersion } from "#/lib/app-version";

export const Route = createFileRoute("/api/health")({
	server: {
		handlers: {
			GET: () => {
				getDb().run(sql`select 1`);
				return Response.json({
					ok: true,
					version: appVersion.version,
					commit: appVersion.commit,
				});
			},
		},
	},
});
