# syntax=docker/dockerfile:1

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

# --- build ---
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
# Build info shown in the app footer and /api/health. Declared after install
# so changing them doesn't bust the dependency cache.
ARG APP_VERSION="" APP_COMMIT="" APP_REPO_URL=""
ENV VITE_APP_VERSION=$APP_VERSION \
    VITE_APP_COMMIT=$APP_COMMIT \
    VITE_APP_REPO_URL=$APP_REPO_URL
RUN pnpm build

# --- runtime ---
# Nitro bundles server deps (including better-sqlite3's native binary) into
# .output, so the runtime image needs no node_modules or build toolchain.
FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/nuzlocke.db \
    MIGRATIONS_DIR=/app/drizzle \
    POKEDATA_DIR=/app/data/pokedata
WORKDIR /app

COPY --from=build /app/.output ./.output
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/data/pokedata ./data/pokedata

RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
