import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { profiles } from "@cockpit/db/schema";

const now = sql`(unixepoch())`;

/** A saved search the scheduler re-runs; filters and sources are snapshots. */
export const xdccWatches = sqliteTable(
  "xdcc_watches",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    query: text("query").notNull(),
    filterJson: text("filter_json", { mode: "json" }).notNull(),
    sourcesJson: text("sources_json", { mode: "json" }).notNull(),
    preferredNetworksJson: text("preferred_networks_json", {
      mode: "json",
    }).notNull(),
    intervalHours: integer("interval_hours").notNull().default(12),
    seriesMode: integer("series_mode", { mode: "boolean" })
      .notNull()
      .default(false),
    seriesFromSeason: integer("series_from_season"),
    seriesFromEpisode: integer("series_from_episode"),
    newness: text("newness").notNull().default("indexed-after"),
    notifyMode: text("notify_mode").notNull().default("default"),
    digest: integer("digest", { mode: "boolean" }).notNull().default(true),
    commandInBody: integer("command_in_body", { mode: "boolean" })
      .notNull()
      .default(true),
    oneShot: integer("one_shot", { mode: "boolean" }).notNull().default(false),
    autoPauseDays: integer("auto_pause_days"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(now),
    lastRunAt: integer("last_run_at", { mode: "timestamp" }),
    lastMatchAt: integer("last_match_at", { mode: "timestamp" }),
    pausedAt: integer("paused_at", { mode: "timestamp" }),
    snoozedUntil: integer("snoozed_until", { mode: "timestamp" }),
  },
  (t) => [index("xdcc_watches_profile_idx").on(t.profileId)],
);

/** Everything a watch has already seen, keyed by release identity, with the offers as of first sight. */
export const xdccSeen = sqliteTable(
  "xdcc_seen",
  {
    watchId: text("watch_id")
      .notNull()
      .references(() => xdccWatches.id, { onDelete: "cascade" }),
    releaseKey: text("release_key").notNull(),
    headline: text("headline").notNull(),
    firstSeenAt: integer("first_seen_at", { mode: "timestamp" }).notNull(),
    offersJson: text("offers_json", { mode: "json" }).notNull(),
    notifiedAt: integer("notified_at", { mode: "timestamp" }),
    seenByUserAt: integer("seen_by_user_at", { mode: "timestamp" }),
  },
  (t) => [
    primaryKey({ columns: [t.watchId, t.releaseKey] }),
    index("xdcc_seen_unseen_idx").on(t.watchId, t.seenByUserAt),
  ],
);
