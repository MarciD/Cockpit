import type { NotifyInput } from "../../../server/contract";
import type { NewReleaseDto, WatchDto, WatchSettings } from "../../types";
import type {
  Clock,
  SeenRepository,
  SeenRow,
  WatchRepository,
} from "../domain/ports";
import { toOfferDto, type Release } from "../domain/release";
import {
  channelsFor,
  identityFor,
  isDue,
  newnessAccepts,
  nextRunAt,
  seriesAccepts,
  severityFor,
  shouldAutoPause,
  type Watch,
} from "../domain/watch";
import type { SearchService } from "./search-service";

const RUN_LIMIT = 50;
const DIGEST_LINES = 3;
const INDIVIDUAL_CAP = 5;
const HOUR_MS = 60 * 60 * 1000;

export interface RunOutcome {
  newCount: number;
  /** The first run only establishes what is already out there; nothing is "new". */
  seeded: boolean;
}

export class WatchService {
  constructor(
    private readonly watches: WatchRepository,
    private readonly seen: SeenRepository,
    private readonly search: SearchService,
    private readonly notify: (input: NotifyInput) => Promise<unknown>,
    private readonly clock: Clock,
    private readonly newId: () => string,
    private readonly log: { warn: (message: string) => void },
  ) {}

  list(profileId: string): WatchDto[] {
    const now = this.clock.now();
    return this.watches.list(profileId).map((w) => this.toDto(w, now));
  }

  get(id: string): WatchDto | undefined {
    const watch = this.watches.get(id);
    return watch ? this.toDto(watch, this.clock.now()) : undefined;
  }

  /** Creates the watch and seeds it right away so day one is quiet. */
  async create(profileId: string, settings: WatchSettings): Promise<WatchDto> {
    const watch = this.watches.insert(
      { ...settings, profileId },
      this.newId(),
      this.clock.now(),
    );
    await this.run(watch.id);
    return this.get(watch.id) as WatchDto;
  }

  update(
    id: string,
    patch: Partial<WatchSettings> & { active?: boolean },
  ): WatchDto | undefined {
    if (!this.watches.get(id)) return undefined;
    const changes: Partial<Watch> = { ...patch };
    if (patch.active === true) {
      changes.pausedAt = null;
      changes.snoozedUntil = null;
    }
    this.watches.update(id, changes);
    return this.get(id);
  }

  remove(id: string): void {
    this.watches.remove(id);
  }

  snooze(id: string, hours: number): WatchDto | undefined {
    const until = new Date(this.clock.now().getTime() + hours * HOUR_MS);
    this.watches.update(id, { snoozedUntil: until });
    return this.get(id);
  }

  async run(id: string): Promise<RunOutcome> {
    const watch = this.watches.get(id);
    if (!watch) throw new Error(`watch ${id} does not exist`);
    const now = this.clock.now();
    const seeded = watch.lastRunAt === null;

    const result = await this.search.search({
      query: watch.query,
      filter: watch.filter,
      sources: watch.sources,
      preferredNetworks: watch.preferredNetworks,
      limit: RUN_LIMIT,
      force: true,
      artwork: false,
    });

    const known = this.seen.keys(id);
    const fresh: SeenRow[] = [];
    for (const release of result.releases) {
      if (!seriesAccepts(watch, release)) continue;
      const key = identityFor(watch, release);
      if (known.has(key)) continue;
      if (!seeded && !newnessAccepts(watch, release)) continue;
      known.add(key);
      fresh.push(this.toSeenRow(watch, key, release, now, seeded));
    }
    this.seen.insertMany(fresh);

    const patch: Partial<Watch> = { lastRunAt: now };
    if (!seeded && fresh.length > 0) {
      patch.lastMatchAt = now;
      await this.announce(watch, fresh);
      if (watch.oneShot) patch.pausedAt = now;
    }
    if (
      !seeded &&
      shouldAutoPause(
        { ...watch, lastMatchAt: patch.lastMatchAt ?? watch.lastMatchAt },
        now,
      )
    ) {
      patch.pausedAt = now;
    }
    this.watches.update(id, patch);
    return { newCount: seeded ? 0 : fresh.length, seeded };
  }

  /** Every active, unsnoozed watch whose interval has elapsed, one after another. */
  async runDue(): Promise<number> {
    const now = this.clock.now();
    let ran = 0;
    for (const watch of this.watches.listActive()) {
      if (!isDue(watch, now)) continue;
      try {
        await this.run(watch.id);
        ran += 1;
      } catch (err) {
        this.log.warn(
          `release watch "${watch.label}" failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));
    }
    return ran;
  }

  unseen(profileId: string, watchId?: string): NewReleaseDto[] {
    return this.seen.listUnseen(profileId, watchId).map((row) => ({
      watchId: row.watchId,
      key: row.key,
      headline: row.headline,
      firstSeenAt: row.firstSeenAt.toISOString(),
      offers: row.offers.map(toOfferDto),
      notifiedAt: row.notifiedAt?.toISOString() ?? null,
    }));
  }

  markSeen(profileId: string, watchId?: string): void {
    this.seen.markSeen(profileId, watchId);
  }

  private toSeenRow(
    watch: Watch,
    key: string,
    release: Release,
    now: Date,
    seeded: boolean,
  ): SeenRow {
    return {
      watchId: watch.id,
      key,
      headline: release.headline,
      firstSeenAt: release.firstSeenAt ?? now,
      offers: release.offers,
      notifiedAt: seeded ? now : null,
      seenByUserAt: seeded ? now : null,
    };
  }

  private async announce(watch: Watch, fresh: SeenRow[]): Promise<void> {
    const url = `/w/xdcc-watch?profile=${encodeURIComponent(watch.profileId)}&watch=${encodeURIComponent(watch.id)}`;
    const base: Omit<NotifyInput, "title" | "body"> = {
      kind: "xdcc.release",
      severity: severityFor(watch.notifyMode),
      profileId: watch.profileId,
      url,
      channels: channelsFor(watch.notifyMode),
      data: { source: "release watch", watchId: watch.id },
    };
    const command = (row: SeenRow) =>
      watch.commandInBody && row.offers[0] ? `\n${row.offers[0].command}` : "";

    if (watch.digest || fresh.length === 1) {
      const [first] = fresh;
      const title =
        fresh.length === 1 && first
          ? `${first.headline} · ${watch.label}`
          : `${fresh.length} new · ${watch.label}`;
      const lines = fresh.slice(0, DIGEST_LINES).map((r) => r.headline);
      if (fresh.length > DIGEST_LINES)
        lines.push(`+${fresh.length - DIGEST_LINES} more`);
      await this.notify({
        ...base,
        title,
        body: `${lines.join("\n")}${first ? command(first) : ""}`,
      });
      return;
    }
    for (const row of fresh.slice(0, INDIVIDUAL_CAP)) {
      await this.notify({
        ...base,
        title: `${row.headline} · ${watch.label}`,
        body: `New on ${row.offers[0]?.network ?? "an indexer"}${command(row)}`,
      });
    }
  }

  private toDto(watch: Watch, now: Date): WatchDto {
    return {
      ...watch,
      createdAt: watch.createdAt.toISOString(),
      lastRunAt: watch.lastRunAt?.toISOString() ?? null,
      lastMatchAt: watch.lastMatchAt?.toISOString() ?? null,
      nextRunAt: nextRunAt(watch, now)?.toISOString() ?? null,
      pausedAt: watch.pausedAt?.toISOString() ?? null,
      snoozedUntil: watch.snoozedUntil?.toISOString() ?? null,
      newCount: this.seen.countUnseen(watch.id),
    };
  }
}
