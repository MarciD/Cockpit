import type { CockpitDb } from "@cockpit/db";

/** The app hands the widget its database handle when the module is built. */
let handle: CockpitDb | null = null;

export function setLearningDb(db: CockpitDb): void {
  handle = db;
}

export function learningDb(): CockpitDb {
  if (!handle) throw new Error("language-learning: database not wired");
  return handle;
}
