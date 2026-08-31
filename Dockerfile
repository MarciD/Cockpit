# cockpit — single-container image. Debian slim (glibc) rather than Alpine, so
# better-sqlite3 and sharp resolve prebuilt binaries instead of compiling.
#
# Deliberately not a `next build --output standalone` image: the native and
# heavy deps are webpack externals reached through transpiled workspace
# packages, and Next's file tracing doesn't reliably carry them across pnpm's
# symlinked node_modules. Installing production deps in the final stage is
# bigger but predictable, and gets binaries built for the target platform.
FROM node:26-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# --- dependencies ------------------------------------------------------------
# Only the manifests, so this layer caches until a dependency actually changes.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/integrations/package.json packages/integrations/
COPY packages/project-setup/package.json packages/project-setup/
COPY packages/widget-sdk/package.json packages/widget-sdk/
COPY packages/widgets/package.json packages/widgets/
RUN pnpm install --frozen-lockfile

# --- build -------------------------------------------------------------------
FROM deps AS build
COPY . .
RUN pnpm build

# --- runtime -----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    COCKPIT_DB_PATH=/data/cockpit.sqlite \
    COCKPIT_CRED_FILE=/data/credentials.enc \
    COCKPIT_MIGRATIONS_DIR=/app/packages/db/drizzle

# Source first (workspace packages ship TS and are resolved by `workspace:*`),
# then the build output, then production-only dependencies. `--chown` on the
# COPY avoids a `chown -R` that would duplicate the whole tree into a layer.
COPY --chown=node:node . .
COPY --from=build --chown=node:node /app/apps/web/.next ./apps/web/.next
RUN pnpm install --frozen-lockfile --prod

# The SQLite database and the encrypted credential file live here. Mount it.
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migrations run on boot from apps/web/instrumentation.ts. Call Next directly
# rather than through pnpm: nothing should touch the package manager at runtime.
WORKDIR /app/apps/web
CMD ["node_modules/.bin/next", "start"]
