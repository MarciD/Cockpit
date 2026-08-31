import { defineConfig } from "drizzle-kit";

// SQLite lives at the repo-root ./data dir (gitignored). Relative to packages/db.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.COCKPIT_DB_PATH ?? "../../data/cockpit.sqlite",
  },
});
