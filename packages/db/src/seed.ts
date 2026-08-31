/**
 * Optional demo seed. cockpit ships with no desks — the app's first-run screen
 * creates one. This script only exists to get a usable dashboard in one command
 * (and to produce the README screenshot); it is never required.
 *
 *   pnpm --filter @cockpit/db db:seed
 *
 * Idempotent: re-running it adds nothing.
 */
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createDb } from "./index";
import { profiles, widgetInstances } from "./schema";

const dbPath = resolve(
  process.env.COCKPIT_DB_PATH ??
    resolve(process.cwd(), "../../data/cockpit.sqlite"),
);
const db = createDb(dbPath);

const DEMO_PROFILE = {
  id: "personal",
  name: "Personal",
  kind: "personal",
  accent: "sage",
  monogram: "PE",
  order: 0,
};

/** Keyless widgets only, so the demo desk works with no credentials at all. */
const DEMO_WIDGETS = ["weather", "news", "todo"];

const existing = db.select().from(profiles).all();
if (existing.length > 0) {
  process.stdout.write(
    `${dbPath} already has ${existing.length} desk(s) — nothing to seed\n`,
  );
} else {
  db.insert(profiles).values(DEMO_PROFILE).run();
  for (const widgetId of DEMO_WIDGETS) {
    db.insert(widgetInstances)
      .values({
        id: randomUUID(),
        profileId: DEMO_PROFILE.id,
        widgetId,
        config: {},
      })
      .run();
  }
  process.stdout.write(`seeded a demo desk into ${dbPath}\n`);
}
