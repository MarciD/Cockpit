/**
 * CLI entry point: `pnpm --filter @cockpit/db db:migrate`.
 *
 * The app also migrates on boot (apps/web/instrumentation.ts), so this is only
 * needed for scripting or to migrate without starting the server.
 */
import { resolve } from "node:path";
import { runMigrations } from "./migrations";

const dbPath = resolve(
  process.env.COCKPIT_DB_PATH ??
    resolve(process.cwd(), "../../data/cockpit.sqlite"),
);
const migrationsDir = resolve(import.meta.dirname, "../drizzle");

runMigrations({ dbPath, migrationsDir });
process.stdout.write(`migrated ${dbPath}\n`);
