# Nuzlocke Tracker

A small self-hosted tracker for Pokémon Nuzlocke runs. Track multiple runs, log one encounter per location, and move catches between party, box, and graveyard.

Built with TanStack Start (React 19), SQLite + Drizzle, Tailwind v4 and shadcn/ui. All Pokémon data and sprites are bundled, so it works without internet access.

## Development

```sh
pnpm install
pnpm dev          # http://localhost:3000, DB at ./data/nuzlocke.db
pnpm test         # vitest
pnpm typecheck
pnpm check        # biome lint + format check (pnpm format to fix)
```

Schema changes: edit `src/db/schema.ts`, then run `pnpm db:generate --name <change>`. Migrations in `drizzle/` are applied automatically on startup.

### Layout

- `src/routes/` — pages (file-based routing) and `api/health`
- `src/server/*.server.ts` — DB logic (server-only, unit tested)
- `src/server/*.functions.ts` — `createServerFn` wrappers called by routes
- `src/db/` — schema, connection, and the reference-data seeder
- `data/pokedata/` — bundled games/species/locations JSON (generated)
- `public/sprites/` — bundled sprites (generated)

## Pokémon data

`pnpm pokedata:fetch` pulls games, species, sprites and per-game locations from PokeAPI into `data/pokedata/` and `public/sprites/`. The output is committed, so you only need to rerun it to refresh the data. Responses are cached in `.cache/`.

On startup the app loads that data into SQLite. Your runs and location edits are never touched.

PokeAPI has no location data for Brilliant Diamond/Shining Pearl, Legends: Arceus, Scarlet/Violet or Legends: Z-A. Those games start with only Starter until you add locations on the Locations page.

### Locations admin

The **Locations** page (header link, or "Edit locations" on a run's Encounters tab) manages each game's location list for all runs of that game:

- **Order**: drag rows into play order (keyboard works too: focus a handle, Space, arrows, Space). "Order all" moves everything into the ordered list so you can start dragging. Unordered locations come after ordered ones, in natural alphabetical order (Route 2 before Route 10).
- **Rename** awkward PokeAPI names.
- **Hide** locations you never use. A hidden location still shows in any run that already logged an encounter there.
- **Add** locations, which is how you fill in games with no PokeAPI data. Added locations can be deleted while no run has logged an encounter there.

Every game also has a built-in **Starter** encounter that is always first. Per-run custom locations (gift Pokémon, fossils, static encounters, etc.) are added from a run's Encounters tab.

These edits live in the database, so back up `nuzlocke.db` to keep them. Reseeding (on startup, or after `pnpm pokedata:fetch`) only inserts new locations and never overwrites names, order or visibility.

## Deployment

Each push to `main` runs checks, then builds `ghcr.io/<owner>/nuzlocke-tracker:latest` (plus a `sha-xxxxxxx` tag) for linux/amd64. Pushing a `v1.2.3` tag also publishes `1.2.3`.

On the server:

```sh
mkdir -p nuzlocke && cd nuzlocke
# copy docker-compose.yml here
mkdir -p data && sudo chown 1000:1000 data   # container runs as uid 1000
docker compose up -d
```

To update: `docker compose pull && docker compose up -d`.

The SQLite database lives at `./data/nuzlocke.db`. To back it up, stop the container and copy the file, or run `sqlite3 data/nuzlocke.db ".backup backup.db"` while it's running.

Environment variables (with defaults in the image): `PORT=3000`, `DATABASE_PATH=/data/nuzlocke.db`.
