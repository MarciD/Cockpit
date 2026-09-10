import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { CockpitDb } from "@cockpit/db";
import type { SeenRepository, SeenRow } from "../domain/ports";
import type { Offer } from "../domain/release";
import { xdccSeen, xdccWatches } from "../schema";

type Row = typeof xdccSeen.$inferSelect;

type StoredOffer = Omit<Offer, "firstSeenAt" | "lastSeenAt"> & {
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

const storeOffer = (o: Offer): StoredOffer => ({
  ...o,
  firstSeenAt: o.firstSeenAt?.toISOString() ?? null,
  lastSeenAt: o.lastSeenAt?.toISOString() ?? null,
});

const reviveOffer = (o: StoredOffer): Offer => ({
  ...o,
  firstSeenAt: o.firstSeenAt ? new Date(o.firstSeenAt) : null,
  lastSeenAt: o.lastSeenAt ? new Date(o.lastSeenAt) : null,
});

function toSeenRow(row: Row): SeenRow {
  return {
    watchId: row.watchId,
    key: row.releaseKey,
    headline: row.headline,
    firstSeenAt: row.firstSeenAt,
    offers: (Array.isArray(row.offersJson)
      ? (row.offersJson as StoredOffer[])
      : []
    ).map(reviveOffer),
    notifiedAt: row.notifiedAt,
    seenByUserAt: row.seenByUserAt,
  };
}

export class DrizzleSeenRepository implements SeenRepository {
  constructor(private readonly db: CockpitDb) {}

  keys(watchId: string): Set<string> {
    const rows = this.db
      .select({ key: xdccSeen.releaseKey })
      .from(xdccSeen)
      .where(eq(xdccSeen.watchId, watchId))
      .all();
    return new Set(rows.map((r) => r.key));
  }

  insertMany(rows: SeenRow[]): void {
    if (rows.length === 0) return;
    this.db
      .insert(xdccSeen)
      .values(
        rows.map((r) => ({
          watchId: r.watchId,
          releaseKey: r.key,
          headline: r.headline,
          firstSeenAt: r.firstSeenAt,
          offersJson: r.offers.map(storeOffer),
          notifiedAt: r.notifiedAt,
          seenByUserAt: r.seenByUserAt,
        })),
      )
      .onConflictDoNothing()
      .run();
  }

  private watchIds(profileId: string): string[] {
    return this.db
      .select({ id: xdccWatches.id })
      .from(xdccWatches)
      .where(eq(xdccWatches.profileId, profileId))
      .all()
      .map((r) => r.id);
  }

  listUnseen(profileId: string, watchId?: string): SeenRow[] {
    const ids = watchId ? [watchId] : this.watchIds(profileId);
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(xdccSeen)
      .where(and(inArray(xdccSeen.watchId, ids), isNull(xdccSeen.seenByUserAt)))
      .orderBy(sql`${xdccSeen.firstSeenAt} desc`)
      .all()
      .map(toSeenRow);
  }

  countUnseen(watchId: string): number {
    const row = this.db
      .select({ n: sql<number>`count(*)` })
      .from(xdccSeen)
      .where(and(eq(xdccSeen.watchId, watchId), isNull(xdccSeen.seenByUserAt)))
      .get();
    return row?.n ?? 0;
  }

  markSeen(profileId: string, watchId?: string): void {
    const ids = watchId ? [watchId] : this.watchIds(profileId);
    if (ids.length === 0) return;
    this.db
      .update(xdccSeen)
      .set({ seenByUserAt: new Date() })
      .where(and(inArray(xdccSeen.watchId, ids), isNull(xdccSeen.seenByUserAt)))
      .run();
  }
}
