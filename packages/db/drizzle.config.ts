import { defineConfig } from "drizzle-kit";

// SQLite lives at the repo-root ./data dir (gitignored). Relative to packages/db.
export default defineConfig({
  dialect: "sqlite",
  // Core tables plus every widget's own `server/schema.ts` (one-folder rule).
  schema: ["./src/schema.ts", "../widgets/src/*/server/schema.ts"],
  out: "./drizzle",
  dbCredentials: {
    url: process.env.COCKPIT_DB_PATH ?? "../../data/cockpit.sqlite",
  },
});
