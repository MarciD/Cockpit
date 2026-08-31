import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface RunMigrationsOptions {
  dbPath: string;
  /**
   * Path to `packages/db/drizzle`. Passed in rather than derived from
   * `import.meta.dirname`, because Next transpiles this package into `.next`
   * chunks where that would resolve to the wrong place.
   */
  migrationsDir: string;
}

/**
 * Apply any pending migrations, creating the database (and its directory) if
 * needed. Idempotent — drizzle records what it has already run — so it is safe
 * to call on every boot.
 */
export function runMigrations({
  dbPath,
  migrationsDir,
}: RunMigrationsOptions): void {
  mkdirSync(dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  try {
    migrate(drizzle(sqlite), { migrationsFolder: migrationsDir });
  } finally {
    sqlite.close();
  }
}
