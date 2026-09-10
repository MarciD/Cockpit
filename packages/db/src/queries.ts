import { and, desc, eq, gt, gte, isNull, lt, lte, sql } from "drizzle-orm";
import type { CockpitDb } from "./index";
import {
  cache,
  conjugations,
  layouts,
  learningScore,
  learningSessions,
  notificationDeliveries,
  notificationPreferences,
  notificationSettings,
  notifications,
  profiles,
  scheduledNotifications,
  recurringTasks,
  todos,
  usageEvents,
  vocabItems,
  widgetInstances,
} from "./schema";

/** Server-side read/write helpers so app code never imports drizzle directly. */

export function listProfiles(db: CockpitDb) {
  return db.select().from(profiles).orderBy(profiles.order).all();
}

export function getProfile(db: CockpitDb, id: string) {
  return db.select().from(profiles).where(eq(profiles.id, id)).get();
}

export function createProfile(
  db: CockpitDb,
  value: {
    id: string;
    name: string;
    kind: string;
    accent?: string | null;
    monogram?: string | null;
  },
) {
  // New desks land at the end of the rail.
  const last = db
    .select({ order: profiles.order })
    .from(profiles)
    .orderBy(desc(profiles.order))
    .limit(1)
    .get();
  db.insert(profiles)
    .values({ ...value, order: (last?.order ?? -1) + 1 })
    .run();
}

export function updateProfile(
  db: CockpitDb,
  id: string,
  patch: {
    name?: string;
    kind?: string;
    accent?: string | null;
    monogram?: string | null;
    order?: number;
  },
) {
  db.update(profiles).set(patch).where(eq(profiles.id, id)).run();
}

/** Widgets, layouts, todos and the rest cascade on the FK. */
export function deleteProfile(db: CockpitDb, id: string) {
  db.delete(profiles).where(eq(profiles.id, id)).run();
}

export function listInstances(db: CockpitDb, profileId: string) {
  return db
    .select()
    .from(widgetInstances)
    .where(eq(widgetInstances.profileId, profileId))
    .all();
}

export function listLayouts(db: CockpitDb, profileId: string) {
  return db
    .select()
    .from(layouts)
    .where(eq(layouts.profileId, profileId))
    .all();
}

/** Upsert a react-grid-layout for one profile + breakpoint. */
export function saveLayout(
  db: CockpitDb,
  profileId: string,
  breakpoint: string,
  layoutJson: unknown,
) {
  db.insert(layouts)
    .values({ profileId, breakpoint, layoutJson })
    .onConflictDoUpdate({
      target: [layouts.profileId, layouts.breakpoint],
      set: { layoutJson },
    })
    .run();
}

export function createWidgetInstance(
  db: CockpitDb,
  value: { id: string; profileId: string; widgetId: string; config: unknown },
) {
  db.insert(widgetInstances).values(value).run();
}

export function updateWidgetInstanceConfig(
  db: CockpitDb,
  id: string,
  config: unknown,
) {
  db.update(widgetInstances)
    .set({ config })
    .where(eq(widgetInstances.id, id))
    .run();
}

export function deleteWidgetInstance(db: CockpitDb, id: string) {
  db.delete(widgetInstances).where(eq(widgetInstances.id, id)).run();
}

// --- server-side stale-while-revalidate cache -------------------------------

export function getCache(db: CockpitDb, key: string) {
  return db.select().from(cache).where(eq(cache.queryKeyHash, key)).get();
}

export function setCache(db: CockpitDb, key: string, payload: unknown) {
  const fetchedAt = new Date();
  db.insert(cache)
    .values({ queryKeyHash: key, payloadJson: payload, fetchedAt })
    .onConflictDoUpdate({
      target: cache.queryKeyHash,
      set: { payloadJson: payload, fetchedAt },
    })
    .run();
}

// --- recurring tasks --------------------------------------------------------

export function listRecurringTasks(db: CockpitDb, profileId?: string) {
  const base = db.select().from(recurringTasks);
  return profileId
    ? base.where(eq(recurringTasks.profileId, profileId)).all()
    : base.all();
}

export function listEnabledRecurringTasks(db: CockpitDb) {
  return db
    .select()
    .from(recurringTasks)
    .where(eq(recurringTasks.enabled, true))
    .all();
}

export function createRecurringTask(
  db: CockpitDb,
  value: {
    id: string;
    profileId: string;
    title: string;
    cron: string;
    nextRunAt?: Date | null;
    enabled?: boolean;
  },
) {
  db.insert(recurringTasks)
    .values({
      id: value.id,
      profileId: value.profileId,
      title: value.title,
      cron: value.cron,
      nextRunAt: value.nextRunAt ?? null,
      enabled: value.enabled ?? true,
    })
    .run();
}

export function updateRecurringTask(
  db: CockpitDb,
  id: string,
  patch: {
    enabled?: boolean;
    nextRunAt?: Date | null;
    title?: string;
    cron?: string;
  },
) {
  db.update(recurringTasks).set(patch).where(eq(recurringTasks.id, id)).run();
}

export function deleteRecurringTask(db: CockpitDb, id: string) {
  db.delete(recurringTasks).where(eq(recurringTasks.id, id)).run();
}

// --- to-dos (ad-hoc checklist) ----------------------------------------------

export function listTodos(db: CockpitDb, profileId: string) {
  return db
    .select()
    .from(todos)
    .where(eq(todos.profileId, profileId))
    .orderBy(todos.order, todos.createdAt)
    .all();
}

/**
 * Local-midnight of today. start/solve are day-granular work markers (they feed
 * timetracking), so we store a clean midnight that round-trips through the date
 * picker — not the exact wall-clock moment.
 */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function createTodo(
  db: CockpitDb,
  value: { id: string; profileId: string; title: string },
) {
  // Creating a todo marks the start of the work, so default the start day now
  // (editable later). createdAt keeps the exact provenance timestamp.
  db.insert(todos)
    .values({
      id: value.id,
      profileId: value.profileId,
      title: value.title,
      startDate: startOfToday(),
    })
    .run();
}

export function setTodo(
  db: CockpitDb,
  id: string,
  patch: {
    done?: boolean;
    title?: string;
    startDate?: Date | null;
    endDate?: Date | null;
  },
) {
  const set: {
    done?: boolean;
    title?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    completedAt?: Date | null;
  } = {};
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.startDate !== undefined) set.startDate = patch.startDate;
  if (patch.endDate !== undefined) set.endDate = patch.endDate;
  if (patch.done !== undefined) {
    set.done = patch.done;
    set.completedAt = patch.done ? new Date() : null;
    // Solve day tracks completion symmetrically: stamp today when completing a
    // todo that has none (preserving any the user already set), and clear it on
    // reopen so a reopened todo never keeps a phantom solve day. Skipped when
    // the caller sets endDate explicitly in the same patch.
    if (patch.endDate === undefined) {
      if (patch.done) {
        const current = db
          .select({ endDate: todos.endDate })
          .from(todos)
          .where(eq(todos.id, id))
          .get();
        if (!current?.endDate) set.endDate = startOfToday();
      } else {
        set.endDate = null;
      }
    }
  }
  db.update(todos).set(set).where(eq(todos.id, id)).run();
}

export function deleteTodo(db: CockpitDb, id: string) {
  db.delete(todos).where(eq(todos.id, id)).run();
}

// --- usage events (feeds widget suggestions) --------------------------------

export function recordUsage(
  db: CockpitDb,
  value: {
    id: string;
    profileId?: string | null;
    kind: string;
    ref?: string | null;
  },
) {
  db.insert(usageEvents)
    .values({
      id: value.id,
      profileId: value.profileId ?? null,
      kind: value.kind,
      ref: value.ref ?? null,
    })
    .run();
}

// --- language learning: vocabulary -----------------------------------------

export function listVocabItems(
  db: CockpitDb,
  profileId: string,
  language: string,
) {
  return db
    .select()
    .from(vocabItems)
    .where(
      and(
        eq(vocabItems.profileId, profileId),
        eq(vocabItems.language, language),
      ),
    )
    .all();
}

export function insertVocabItems(
  db: CockpitDb,
  rows: Array<{
    id: string;
    profileId: string;
    language: string;
    category: string;
    term: string;
    translation: string;
    notes?: string | null;
    topic?: string | null;
    source?: string;
  }>,
) {
  if (rows.length === 0) return;
  db.insert(vocabItems)
    .values(
      rows.map((r) => ({
        id: r.id,
        profileId: r.profileId,
        language: r.language,
        category: r.category,
        term: r.term,
        translation: r.translation,
        notes: r.notes ?? null,
        topic: r.topic ?? null,
        source: r.source ?? "csv",
      })),
    )
    .run();
}

export function updateVocabItem(
  db: CockpitDb,
  id: string,
  patch: {
    category?: string;
    term?: string;
    translation?: string;
    notes?: string | null;
  },
) {
  db.update(vocabItems).set(patch).where(eq(vocabItems.id, id)).run();
}

export function deleteVocabItem(db: CockpitDb, id: string) {
  db.delete(vocabItems).where(eq(vocabItems.id, id)).run();
}

/** Record one answered item: bump exposure, accuracy and per-item streak. */
export function recordVocabAnswer(db: CockpitDb, id: string, correct: boolean) {
  db.update(vocabItems)
    .set({
      seen: sql`${vocabItems.seen} + 1`,
      correct: correct
        ? sql`${vocabItems.correct} + 1`
        : sql`${vocabItems.correct}`,
      itemStreak: correct ? sql`${vocabItems.itemStreak} + 1` : sql`0`,
      lastSeenAt: new Date(),
    })
    .where(eq(vocabItems.id, id))
    .run();
}

// --- language learning: score + sessions ------------------------------------

export function getLearningScore(
  db: CockpitDb,
  profileId: string,
  language: string,
) {
  return db
    .select()
    .from(learningScore)
    .where(
      and(
        eq(learningScore.profileId, profileId),
        eq(learningScore.language, language),
      ),
    )
    .get();
}

export function upsertLearningScore(
  db: CockpitDb,
  value: {
    profileId: string;
    language: string;
    dailyGoalItems?: number;
    lastActiveDay?: string | null;
    streakDays?: number;
    streakFreezes?: number;
  },
) {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (value.dailyGoalItems !== undefined)
    set.dailyGoalItems = value.dailyGoalItems;
  if (value.lastActiveDay !== undefined)
    set.lastActiveDay = value.lastActiveDay;
  if (value.streakDays !== undefined) set.streakDays = value.streakDays;
  if (value.streakFreezes !== undefined)
    set.streakFreezes = value.streakFreezes;
  db.insert(learningScore)
    .values({
      profileId: value.profileId,
      language: value.language,
      dailyGoalItems: value.dailyGoalItems ?? 10,
      lastActiveDay: value.lastActiveDay ?? null,
      streakDays: value.streakDays ?? 0,
      streakFreezes: value.streakFreezes ?? 2,
    })
    .onConflictDoUpdate({
      target: [learningScore.profileId, learningScore.language],
      set,
    })
    .run();
}

export function appendLearningSession(
  db: CockpitDb,
  value: {
    id: string;
    profileId: string;
    language: string;
    itemsAnswered: number;
    correct: number;
    mode: string;
  },
) {
  db.insert(learningSessions).values(value).run();
}

// --- language learning: conjugation cache -----------------------------------

export function getConjugation(db: CockpitDb, language: string, verb: string) {
  return db
    .select()
    .from(conjugations)
    .where(
      and(eq(conjugations.language, language), eq(conjugations.verb, verb)),
    )
    .get();
}

export function putConjugation(
  db: CockpitDb,
  language: string,
  verb: string,
  tableJson: unknown,
) {
  db.insert(conjugations)
    .values({ language, verb, tableJson })
    .onConflictDoUpdate({
      target: [conjugations.language, conjugations.verb],
      set: { tableJson },
    })
    .run();
}

/** Sessions since a cutoff (for the tile's 7-day sparkline + stats). */
export function listLearningSessionsSince(
  db: CockpitDb,
  profileId: string,
  language: string,
  since: Date,
) {
  return db
    .select()
    .from(learningSessions)
    .where(
      and(
        eq(learningSessions.profileId, profileId),
        eq(learningSessions.language, language),
        gte(learningSessions.at, since),
      ),
    )
    .orderBy(desc(learningSessions.at))
    .all();
}

// --- notifications ----------------------------------------------------------

export type NotificationRow = typeof notifications.$inferSelect;

export function insertNotification(
  db: CockpitDb,
  value: typeof notifications.$inferInsert,
): NotificationRow {
  return db.insert(notifications).values(value).returning().get();
}

/** The newest row carrying this dedupe key created after `since`, if any. */
export function findNotificationByDedupeKey(
  db: CockpitDb,
  dedupeKey: string,
  since: Date,
): NotificationRow | undefined {
  return db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.dedupeKey, dedupeKey),
        gt(notifications.createdAt, since),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(1)
    .get();
}

/** Newest first, dismissed rows excluded; `since` narrows to rows created after it. */
export function listNotifications(
  db: CockpitDb,
  options: { since?: Date; unreadOnly?: boolean; limit?: number } = {},
): NotificationRow[] {
  const conditions = [isNull(notifications.dismissedAt)];
  if (options.since)
    conditions.push(gt(notifications.createdAt, options.since));
  if (options.unreadOnly) conditions.push(isNull(notifications.readAt));
  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(options.limit ?? 50)
    .all();
}

export function countUnreadNotifications(db: CockpitDb): number {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(notifications)
    .where(and(isNull(notifications.readAt), isNull(notifications.dismissedAt)))
    .get();
  return row?.n ?? 0;
}

export function setNotificationRead(db: CockpitDb, id: string, read: boolean) {
  db.update(notifications)
    .set({ readAt: read ? new Date() : null })
    .where(eq(notifications.id, id))
    .run();
}

export function markAllNotificationsRead(db: CockpitDb): number {
  return db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(isNull(notifications.readAt), isNull(notifications.dismissedAt)))
    .returning({ id: notifications.id })
    .all().length;
}

export function dismissNotification(db: CockpitDb, id: string) {
  const now = new Date();
  db.update(notifications)
    .set({
      dismissedAt: now,
      readAt: sql`coalesce(${notifications.readAt}, ${Math.floor(now.getTime() / 1000)})`,
    })
    .where(eq(notifications.id, id))
    .run();
}

/** Drop read or dismissed rows older than `before`. Returns the number removed. */
export function pruneNotifications(db: CockpitDb, before: Date): number {
  return db
    .delete(notifications)
    .where(
      and(
        lt(notifications.createdAt, before),
        sql`(${notifications.readAt} is not null or ${notifications.dismissedAt} is not null)`,
      ),
    )
    .returning({ id: notifications.id })
    .all().length;
}

// --- notification preferences, settings, deliveries, reminders -------------

export function listNotificationPreferences(db: CockpitDb) {
  return db.select().from(notificationPreferences).all();
}

export function upsertNotificationPreference(
  db: CockpitDb,
  kind: string,
  channels: string[],
) {
  const updatedAt = new Date();
  db.insert(notificationPreferences)
    .values({ kind, channelsJson: channels, updatedAt })
    .onConflictDoUpdate({
      target: notificationPreferences.kind,
      set: { channelsJson: channels, updatedAt },
    })
    .run();
}

export function deleteNotificationPreference(db: CockpitDb, kind: string) {
  db.delete(notificationPreferences)
    .where(eq(notificationPreferences.kind, kind))
    .run();
}

const SETTINGS_ROW_ID = "default";

export function getNotificationSettings(db: CockpitDb) {
  return db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.id, SETTINGS_ROW_ID))
    .get();
}

export function upsertNotificationSettings(
  db: CockpitDb,
  value: {
    quietFrom: string | null;
    quietTo: string | null;
    publicUrl: string | null;
  },
) {
  const updatedAt = new Date();
  db.insert(notificationSettings)
    .values({ id: SETTINGS_ROW_ID, ...value, updatedAt })
    .onConflictDoUpdate({
      target: notificationSettings.id,
      set: { ...value, updatedAt },
    })
    .run();
}

export type NotificationDeliveryRow =
  typeof notificationDeliveries.$inferSelect;

export function recordNotificationDelivery(
  db: CockpitDb,
  value: typeof notificationDeliveries.$inferInsert,
) {
  db.insert(notificationDeliveries).values(value).run();
}

/** The most recent attempt on one channel. */
export function latestNotificationDelivery(
  db: CockpitDb,
  channel: string,
): NotificationDeliveryRow | undefined {
  return db
    .select()
    .from(notificationDeliveries)
    .where(eq(notificationDeliveries.channel, channel))
    .orderBy(desc(notificationDeliveries.at))
    .limit(1)
    .get();
}

export type ScheduledNotificationRow =
  typeof scheduledNotifications.$inferSelect;

export function insertScheduledNotification(
  db: CockpitDb,
  value: typeof scheduledNotifications.$inferInsert,
): ScheduledNotificationRow {
  return db.insert(scheduledNotifications).values(value).returning().get();
}

/** Unfired rows whose time has come, oldest first. */
export function listDueScheduledNotifications(
  db: CockpitDb,
  now: Date,
  limit = 100,
): ScheduledNotificationRow[] {
  return db
    .select()
    .from(scheduledNotifications)
    .where(
      and(
        isNull(scheduledNotifications.firedAt),
        lte(scheduledNotifications.fireAt, now),
      ),
    )
    .orderBy(scheduledNotifications.fireAt)
    .limit(limit)
    .all();
}

export function markScheduledNotificationFired(
  db: CockpitDb,
  id: string,
  at: Date,
) {
  db.update(scheduledNotifications)
    .set({ firedAt: at })
    .where(eq(scheduledNotifications.id, id))
    .run();
}

export function cancelScheduledNotification(db: CockpitDb, id: string) {
  db.delete(scheduledNotifications)
    .where(
      and(
        eq(scheduledNotifications.id, id),
        isNull(scheduledNotifications.firedAt),
      ),
    )
    .run();
}

/** Fired rows older than `before` are history nobody reads; drop them. */
export function pruneScheduledNotifications(
  db: CockpitDb,
  before: Date,
): number {
  return db
    .delete(scheduledNotifications)
    .where(
      and(
        lt(scheduledNotifications.fireAt, before),
        sql`${scheduledNotifications.firedAt} is not null`,
      ),
    )
    .returning({ id: scheduledNotifications.id })
    .all().length;
}
