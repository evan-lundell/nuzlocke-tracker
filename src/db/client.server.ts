import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { seedRefdata } from "./seed-refdata.server";

export type Db = ReturnType<typeof openDb>;

/** Opens a database and applies migrations. Use ":memory:" for tests. */
export function openDb(file: string) {
	let sqlite: Database.Database;
	try {
		if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
		sqlite = new Database(file);
	} catch (err) {
		throw new Error(
			`Cannot open database at ${file}. If running in Docker, make sure the mounted data directory is writable by uid 1000 (e.g. chown 1000:1000 ./data).`,
			{ cause: err },
		);
	}
	sqlite.pragma("journal_mode = WAL");
	sqlite.pragma("foreign_keys = ON");
	sqlite.pragma("busy_timeout = 5000");

	const db = drizzle({ client: sqlite, schema });
	migrate(db, {
		migrationsFolder:
			process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), "drizzle"),
	});
	return db;
}

// Cached on globalThis so dev-server HMR doesn't open a new connection per reload
const globalForDb = globalThis as unknown as { __db?: Db };

export function getDb(): Db {
	if (!globalForDb.__db) {
		const db = openDb(
			process.env.DATABASE_PATH ??
				path.resolve(process.cwd(), "data/nuzlocke.db"),
		);
		seedRefdata(
			db,
			process.env.POKEDATA_DIR ?? path.resolve(process.cwd(), "data/pokedata"),
		);
		globalForDb.__db = db;
	}
	return globalForDb.__db;
}
