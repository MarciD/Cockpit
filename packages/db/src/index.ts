import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { restrictDbFileMode } from "./file-mode";
import * as schema from "./schema";

export * as schema from "./schema";
export type Schema = typeof schema;
export * from "./queries";
export * from "./migrations";

/** Open (or create) the local SQLite database with sane pragmas. */
export function createDb(dbPath: string) {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  // After the WAL pragma, so -wal and -shm exist and get tightened too.
  restrictDbFileMode(dbPath);
  return drizzle(sqlite, { schema });
}

export type CockpitDb = ReturnType<typeof createDb>;
