import { runMigrations } from "@cockpit/db";
import { assertCredentialStoreReady } from "./credentials";
import { dbPath, migrationsDir } from "./db";
import { startScheduler } from "./scheduler";

/**
 * Server start-up, in order: fail fast on a missing secret, bring the schema up
 * to date, then start the scheduler. Node-only — imported dynamically from
 * instrumentation.ts so it never reaches the Edge bundle.
 */
export function boot(): void {
  assertCredentialStoreReady();
  // Idempotent, so a fresh install and every container start set themselves up.
  runMigrations({ dbPath: dbPath(), migrationsDir: migrationsDir() });
  startScheduler();
}
