# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A tracker for Pokemon nuzlocke runs. Core flow: a user picks a game, gets a prepopulated list of routes for that game, and logs per-route encounters (species, caught y/n, nickname, status, location).

At run setup, the user selects "rules" for the run rather than the app offering a small fixed set of toggles. Rules vary in kind:

- Some are enforced by real app logic (type-lock and Legacy, below, are examples).
- Some are purely informational/reminder rules with no enforcement (e.g. a self-imposed limit on items usable per encounter — the app just helps the user track it).
- Not all rules are designed yet; more will be added incrementally, and users may eventually be able to author their own custom (likely informational-only) rules.

Two rules with real app logic are designed so far, and can be combined on the same run:

- **Type-lock**: the active party cannot contain duplicate types. For dual-typed Pokemon, the player chooses one of its two types at the moment of catching, and the Pokemon is permanently locked to that single type from then on.
- **Legacy** (name may change): a points economy layered on a normal run. Points are earned by actions (catching a Pokemon = 1, winning a rival battle = 3, beating a gym = 5 — list not final) and spent on actions that help the run (re-encounter on a route = 5 points, resurrecting a dead Pokemon = 10+ points, kept expensive). "Resurrecting" simply resets a Pokemon's status back to alive — it is a record correction, not a re-catch mechanic.

v1 scope targets a single game (e.g. Leaf Green) rather than a full generation. Route/encounter data is planned to be seeded into the database from [PokeAPI](https://pokeapi.co) via a one-time import script, not hand-curated or queried live at request time.

Users can also use the tracker without an account via **guest mode**, backed by browser localStorage instead of the backend/database. Open question, to resolve when the auth/data-access layer is designed: how a guest's local data migrates into a real account if they later sign up.

This is a hobby project, but with real ambitions: real backend, real database, user accounts, and an eventual deploy for real users — not a throwaway prototype.

## Repository layout

Two independent top-level apps, no monorepo tooling (no npm workspaces, no Turborepo):

- `backend/` — NestJS (TypeScript) API
- `frontend/` — React + Vite (TypeScript) SPA, talks to the backend over HTTP (no server-side rendering)

Each has its own `package.json`, `node_modules`, and lockfile. There is currently no shared-types package between them; if that becomes painful (e.g. once we want API request/response types shared with the frontend), that's the trigger to introduce a monorepo tool (Turborepo) — not before.

## Commands

Run each app from within its own directory.

### Backend (`backend/`)

- `npm run start:dev` — start in watch mode (auto-reload), the normal way to run it locally
- `npm run start` — start once, no watch
- `npm run build` — compile with `nest build`
- `npm run lint` — eslint with `--fix`
- `npm run test` — unit tests (Jest)
- `npm run test:watch` — unit tests in watch mode
- `npm run test:e2e` — e2e tests (uses `test/jest-e2e.json`)
- `npm run test:cov` — unit tests with coverage
- To run a single unit test file: `npx jest path/to/file.spec.ts` (rootDir for Jest is `src/`, test files matched by `*.spec.ts`)

### Frontend (`frontend/`)

- `npm run dev` — start the Vite dev server
- `npm run build` — typecheck (`tsc -b`) then production build
- `npm run lint` — oxlint
- `npm run preview` — preview a production build locally

There is currently no single command that starts both apps together — run them in two terminals. A unified dev-runner (e.g. `concurrently`, or Task/go-task) was discussed and deliberately deferred until more services (Docker/Postgres, etc.) are in the mix.

## Tech stack decisions

- **Backend**: NestJS (TypeScript)
- **Frontend**: React + Vite (TypeScript SPA — not Next.js; NestJS is already the API layer, so a second server-rendering layer would be redundant)
- **Database**: PostgreSQL (schema designed, not yet provisioned — see Current status)
- **ORM**: Prisma (added to `backend/`, schema in progress)
- **Auth**: NestJS's Passport integration, OAuth via Google/GitHub — no email/password login planned for v1
- **Deploy target**: not finalized; leaning toward Railway or Fly.io

TypeScript was chosen over Go for this project specifically so the whole stack shares one language (and can share types between frontend/backend); Go is being learned separately, outside this project.

## Current status

Initial scaffold for `backend/` and `frontend/` is in place and committed; both boot/build clean, but contain no application logic beyond the framework defaults.

Prisma is added to `backend/` (v7, using the new `prisma-client` generator, output to `backend/generated/prisma`; config lives in `backend/prisma.config.ts` rather than `package.json`). A real Postgres instance is provisioned on Neon (free tier); `backend/.env` holds a real `DATABASE_URL` pointing at a dev branch (kept separate from Neon's default/production branch, which stays untouched until deploy). It's a single direct (non-pooled) connection — no pgbouncer — since NestJS is a long-running server process that keeps its own connection pool open, unlike the serverless/edge functions Neon's pooled endpoint is designed for. The first migration (`init`) has been generated and applied.

Schema design work, in Git history/branch order:
- On `main`: reference data seeded from PokeAPI — `Game`, `Route`, `Species` (regional variants are sibling rows sharing a `pokedexNumber`; evolution modeled as a self-referencing `evolvesFrom` tree, which also serves as the "same dupe family" check), `RouteSpecies` (a non-binding "normally found here" list per route — logged encounters can still reference any species, for randomizer support).
- On branch `schema/user-run-legacy` (not yet merged): `User`/`AuthAccount` (auth identity split out to support linking multiple OAuth providers later), `Run`/`Legacy` (a `Legacy` groups a chain of runs on one game where a failed run hands off to a successor with carried-over points), `Encounter` (one row per logged encounter; keyed on `(run, route, label)` so users can log extra ad hoc encounters per route, e.g. a static Snorlax tracked separately from the route's wild encounter), `PartyMembership` (active-party membership tracked as row existence, kept separate from `Encounter` since team composition changes far more often than the encounter log).
- Also on `schema/user-run-legacy`: the rules system. `Rule` is a catalog table (`kind: ENFORCED | INFORMATIONAL`) shared by built-in rules (`createdById` null, visible to everyone) and future user-authored custom rules (`createdById` set, visible only to their creator — enforced at the query/app layer, not schema-constrained); `RunRule` joins a `Run` to its selected rules with an optional `config` JSON for rule-specific settings. Legacy is deliberately kept as a *mode* rather than a rule — signaled by `Run.legacyId` alone, not a `Rule`/`RunRule` row. Type-lock's chosen type lives on `Encounter.lockedType`. `Legacy.points` is backed by a `LegacyPointTransaction` ledger (amount, reason, run) so per-action point values — not finalized yet — can be retuned without losing history.
- All tables/columns are mapped via `@@map`/`@map` to plural snake_case names in Postgres (`games`, `route_species`, `auth_accounts`, `run_rules`, etc.) while the Prisma schema and generated TS client keep idiomatic camelCase/PascalCase — otherwise Prisma writes model/field names verbatim into quoted DDL, which breaks the moment anything queries the DB directly without matching quoting. Enum types get the same snake_case mapping; enum values stay uppercase as constants. `User` maps to plural `users` like everything else (avoids colliding with Postgres's `USER`/`CURRENT_USER`).

Not yet designed: the actual catalog of built-in rules beyond type-lock (no seed data yet), the rule-loosening mechanic (how spending Legacy points actually loosens rules in practice), and finalized point values per action.
