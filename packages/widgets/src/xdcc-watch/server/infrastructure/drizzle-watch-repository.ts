import { and, eq, isNull } from "drizzle-orm";
import type { CockpitDb } from "@cockpit/db";
import type {
  NewnessRule,
  NotifyMode,
  ReleaseFilter,
  SourceId,
} from "../../types";
import { SOURCE_IDS } from "../../types";
import type { WatchRepository } from "../domain/ports";
import {
  NEWNESS_RULES,
  NOTIFY_MODES,
  type NewWatch,
  type Watch,
} from "../domain/watch";
import { xdccWatches } from "../schema";

type Row = typeof xdccWatches.$inferSelect;

function toWatch(row: Row): Watch {
  const sources = (
    Array.isArray(row.sourcesJson) ? row.sourcesJson : []
  ).filter((s): s is SourceId =>
    (SOURCE_IDS as readonly unknown[]).includes(s),
  );
  return {
    id: row.id,
    profileId: row.profileId,
    label: row.label,
    query: row.query,
    filter: row.filterJson as ReleaseFilter,
    sources,
    preferredNetworks: Array.isArray(row.preferredNetworksJson)
      ? (row.preferredNetworksJson as string[])
      : [],
    intervalHours: row.intervalHours,
    seriesMode: row.seriesMode,
    seriesFrom:
      row.seriesFromSeason !== null && row.seriesFromEpisode !== null
        ? { season: row.seriesFromSeason, episode: row.seriesFromEpisode }
        : null,
    newness: (NEWNESS_RULES as readonly string[]).includes(row.newness)
      ? (row.newness as NewnessRule)
      : "indexed-after",
    notifyMode: (NOTIFY_MODES as readonly string[]).includes(row.notifyMode)
      ? (row.notifyMode as NotifyMode)
      : "default",
    digest: row.digest,
    commandInBody: row.commandInBody,
    oneShot: row.oneShot,
    autoPauseDays: row.autoPauseDays,
    active: row.active,
    createdAt: row.createdAt,
    lastRunAt: row.lastRunAt,
    lastMatchAt: row.lastMatchAt,
    pausedAt: row.pausedAt,
    snoozedUntil: row.snoozedUntil,
  };
}

function toColumns(
  patch: Partial<Watch>,
): Partial<typeof xdccWatches.$inferInsert> {
  const out: Partial<typeof xdccWatches.$inferInsert> = {};
  if (patch.label !== undefined) out.label = patch.label;
  if (patch.query !== undefined) out.query = patch.query;
  if (patch.filter !== undefined) out.filterJson = patch.filter;
  if (patch.sources !== undefined) out.sourcesJson = patch.sources;
  if (patch.preferredNetworks !== undefined)
    out.preferredNetworksJson = patch.preferredNetworks;
  if (patch.intervalHours !== undefined)
    out.intervalHours = patch.intervalHours;
  if (patch.seriesMode !== undefined) out.seriesMode = patch.seriesMode;
  if (patch.seriesFrom !== undefined) {
    out.seriesFromSeason = patch.seriesFrom?.season ?? null;
    out.seriesFromEpisode = patch.seriesFrom?.episode ?? null;
  }
  if (patch.newness !== undefined) out.newness = patch.newness;
  if (patch.notifyMode !== undefined) out.notifyMode = patch.notifyMode;
  if (patch.digest !== undefined) out.digest = patch.digest;
  if (patch.commandInBody !== undefined)
    out.commandInBody = patch.commandInBody;
  if (patch.oneShot !== undefined) out.oneShot = patch.oneShot;
  if (patch.autoPauseDays !== undefined)
    out.autoPauseDays = patch.autoPauseDays;
  if (patch.active !== undefined) out.active = patch.active;
  if (patch.lastRunAt !== undefined) out.lastRunAt = patch.lastRunAt;
  if (patch.lastMatchAt !== undefined) out.lastMatchAt = patch.lastMatchAt;
  if (patch.pausedAt !== undefined) out.pausedAt = patch.pausedAt;
  if (patch.snoozedUntil !== undefined) out.snoozedUntil = patch.snoozedUntil;
  return out;
}

export class DrizzleWatchRepository implements WatchRepository {
  constructor(private readonly db: CockpitDb) {}

  list(profileId: string): Watch[] {
    return this.db
      .select()
      .from(xdccWatches)
      .where(eq(xdccWatches.profileId, profileId))
      .orderBy(xdccWatches.createdAt)
      .all()
      .map(toWatch);
  }

  listActive(): Watch[] {
    return this.db
      .select()
      .from(xdccWatches)
      .where(and(eq(xdccWatches.active, true), isNull(xdccWatches.pausedAt)))
      .all()
      .map(toWatch);
  }

  get(id: string): Watch | undefined {
    const row = this.db
      .select()
      .from(xdccWatches)
      .where(eq(xdccWatches.id, id))
      .get();
    return row ? toWatch(row) : undefined;
  }

  insert(value: NewWatch, id: string, createdAt: Date): Watch {
    const row = this.db
      .insert(xdccWatches)
      .values({
        id,
        profileId: value.profileId,
        label: value.label,
        query: value.query,
        filterJson: value.filter,
        sourcesJson: value.sources,
        preferredNetworksJson: value.preferredNetworks,
        intervalHours: value.intervalHours,
        seriesMode: value.seriesMode,
        seriesFromSeason: value.seriesFrom?.season ?? null,
        seriesFromEpisode: value.seriesFrom?.episode ?? null,
        newness: value.newness,
        notifyMode: value.notifyMode,
        digest: value.digest,
        commandInBody: value.commandInBody,
        oneShot: value.oneShot,
        autoPauseDays: value.autoPauseDays,
        createdAt,
      })
      .returning()
      .get();
    return toWatch(row);
  }

  update(id: string, patch: Partial<Watch>): void {
    const columns = toColumns(patch);
    if (Object.keys(columns).length === 0) return;
    this.db
      .update(xdccWatches)
      .set(columns)
      .where(eq(xdccWatches.id, id))
      .run();
  }

  remove(id: string): void {
    this.db.delete(xdccWatches).where(eq(xdccWatches.id, id)).run();
  }
}
