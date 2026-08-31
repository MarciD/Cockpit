import { resolve } from "node:path";
import { createDb, type CockpitDb } from "@cockpit/db";

// Shared across route bundles + instrumentation (one SQLite connection).
const globalForDb = globalThis as unknown as { cockpitDb?: CockpitDb };

/**
 * Where the SQLite file lives. Defaults to the repo's `data/` directory,
 * resolved from `apps/web` (the cwd `next start`/`next dev` run in). Docker
 * sets COCKPIT_DB_PATH to a mounted volume instead.
 */
export function dbPath(): string {
  return resolve(
    process.env.COCKPIT_DB_PATH ??
      resolve(process.cwd(), "../../data/cockpit.sqlite"),
  );
}

/** Where the generated drizzle migrations live. */
export function migrationsDir(): string {
  return resolve(
    process.env.COCKPIT_MIGRATIONS_DIR ??
      resolve(process.cwd(), "../../packages/db/drizzle"),
  );
}

/** Process-wide SQLite handle. Server-only (route handlers, server components). */
export function getDb(): CockpitDb {
  globalForDb.cockpitDb ??= createDb(dbPath());
  return globalForDb.cockpitDb;
}
