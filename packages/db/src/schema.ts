import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch())`;

/** A "desk": one hat the user wears (a job, a side project, personal life). */
export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // 'company' | 'personal'
  accent: text("accent"), // hue token, e.g. 'petrol' | 'berry' | 'iris' | 'sage'
  /** Optional two-letter rail monogram. Falls back to the name's first two. */
  monogram: text("monogram"),
  order: integer("order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(now),
});

/** A configured placement of a widget on a profile. */
export const widgetInstances = sqliteTable("widget_instances", {
  id: text("id").primaryKey(),
  profileId: text("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  widgetId: text("widget_id").notNull(),
  config: text("config", { mode: "json" }).notNull(),
});

/** Per-profile react-grid-layout, one row per responsive breakpoint. */
export const layouts = sqliteTable(
  "layouts",
  {
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    breakpoint: text("breakpoint").notNull(), // 'lg' | 'md' | 'sm' | 'xs'
    layoutJson: text("layout_json", { mode: "json" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.breakpoint] })],
);

/** Reference only — the secret itself lives in the CredentialStore (Keychain). */
export const credentialRefs = sqliteTable("credential_refs", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(), // 'gitlab' | 'jira' | 'google' | 'anthropic'
  profileId: text("profile_id").references(() => profiles.id, {
    onDelete: "cascade",
  }),
  storeKey: text("store_key").notNull(),
});

export const cronJobs = sqliteTable("cron_jobs", {
  id: text("id").primaryKey(),
  widgetInstanceId: text("widget_instance_id").references(
    () => widgetInstances.id,
    { onDelete: "cascade" },
  ),
  kind: text("kind").notNull(), // 'refresh' | 'recurring-task' | 'suggestion-scan'
  cron: text("cron").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  nextRunAt: integer("next_run_at", { mode: "timestamp" }),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
});

export const jobRuns = sqliteTable("job_runs", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => cronJobs.id, { onDelete: "cascade" }),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
  status: text("status").notNull(), // 'ok' | 'error'
  error: text("error"),
});

export const recurringTasks = sqliteTable("recurring_tasks", {
  id: text("id").primaryKey(),
  profileId: text("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  cron: text("cron").notNull(),
  nextRunAt: integer("next_run_at", { mode: "timestamp" }),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
});

/** Ad-hoc manual checklist per desk (distinct from time-driven recurringTasks). */
export const todos = sqliteTable("todos", {
  id: text("id").primaryKey(),
  profileId: text("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  order: integer("order").notNull().default(0),
  startDate: integer("start_date", { mode: "timestamp" }),
  endDate: integer("end_date", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(now),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

/** Server-side stale-while-revalidate cache the scheduler keeps warm. */
export const cache = sqliteTable("cache", {
  queryKeyHash: text("query_key_hash").primaryKey(),
  payloadJson: text("payload_json", { mode: "json" }).notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
});

/** Lightweight local telemetry that feeds widget suggestions. */
export const usageEvents = sqliteTable("usage_events", {
  id: text("id").primaryKey(),
  profileId: text("profile_id"),
  kind: text("kind").notNull(), // 'view-widget' | 'open-profile' | 'assistant-intent' | 'tool-call'
  ref: text("ref"), // widgetId / tool name / intent slug
  at: integer("at", { mode: "timestamp" }).notNull().default(now),
});

export const suggestions = sqliteTable("suggestions", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").references(() => profiles.id, {
    onDelete: "cascade",
  }),
  widgetId: text("widget_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'accepted' | 'dismissed'
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(now),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").references(() => profiles.id, {
    onDelete: "cascade",
  }),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(now),
});

/**
 * Language-learning widget. Generic + multi-language: every row is scoped by a
 * `language` code so several widget instances (es, fr, …) coexist in one table.
 * The vocabulary is the source of truth once imported from CSV; progress lives
 * inline (weighted practice, no per-item due dates).
 */
export const vocabItems = sqliteTable("vocab_items", {
  id: text("id").primaryKey(),
  profileId: text("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  language: text("language").notNull(), // e.g. 'es' | 'fr'
  category: text("category").notNull(), // noun | verb_infinitive | grammar | common_word | phrase | time_word | time_phrase
  term: text("term").notNull(), // the target-language word/chunk
  translation: text("translation").notNull(), // the native-language meaning
  notes: text("notes"),
  topic: text("topic"), // theme this item was learned under (e.g. 'restaurant'), or null
  seen: integer("seen").notNull().default(0),
  correct: integer("correct").notNull().default(0),
  itemStreak: integer("item_streak").notNull().default(0), // consecutive correct
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
  source: text("source").notNull().default("csv"), // 'csv' | 'claude' | 'manual'
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(now),
});

/** Motivation state, one row per (profile, language). No stored XP currency —
 *  "today's score" is derived from learningSessions as itemsAnswered × accuracy. */
export const learningScore = sqliteTable(
  "learning_score",
  {
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    dailyGoalItems: integer("daily_goal_items").notNull().default(10),
    lastActiveDay: text("last_active_day"), // 'YYYY-MM-DD' local
    streakDays: integer("streak_days").notNull().default(0),
    streakFreezes: integer("streak_freezes").notNull().default(2),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(now),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.language] })],
);

/** Cache of generated verb conjugation tables, so a verb lesson is offline/free
 *  after the first generation. Keyed by (language, verb). */
export const conjugations = sqliteTable(
  "conjugations",
  {
    language: text("language").notNull(),
    verb: text("verb").notNull(),
    tableJson: text("table_json", { mode: "json" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(now),
  },
  (t) => [primaryKey({ columns: [t.language, t.verb] })],
);

/** One row per finished practice session — feeds the tile sparkline + honest stats. */
export const learningSessions = sqliteTable("learning_sessions", {
  id: text("id").primaryKey(),
  profileId: text("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  language: text("language").notNull(),
  at: integer("at", { mode: "timestamp" }).notNull().default(now),
  itemsAnswered: integer("items_answered").notNull().default(0),
  correct: integer("correct").notNull().default(0),
  mode: text("mode").notNull(), // 'words' | 'verbs' | 'level' | 'general'
});

/**
 * App-wide notifications. The row is the inbox entry and the source of truth;
 * delivery channels (desktop, phone) fan out from it. `profile_id` is null for
 * app-level events (a job failed, a credential was rejected).
 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),
    kind: text("kind").notNull(), // namespaced, e.g. 'tasks.due', 'integration.auth-failed'
    severity: text("severity").notNull().default("info"), // 'info' | 'action' | 'urgent'
    title: text("title").notNull(),
    body: text("body"),
    url: text("url"), // same-origin deep link
    dataJson: text("data_json", { mode: "json" }),
    dedupeKey: text("dedupe_key"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(now),
    readAt: integer("read_at", { mode: "timestamp" }),
    dismissedAt: integer("dismissed_at", { mode: "timestamp" }),
  },
  (t) => [
    index("notifications_dedupe_idx").on(t.dedupeKey),
    index("notifications_created_idx").on(t.createdAt),
  ],
);
