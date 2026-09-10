import type {
  NewnessRule,
  NotifyMode,
  ReleaseFilter,
  SourceId,
  WatchSettings,
} from "../../types";
import type { Release } from "./release";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** A pack first indexed a little before the watch existed still counts as new. */
export const NEWNESS_GRACE_MS = 24 * HOUR_MS;

export interface Watch extends WatchSettings {
  id: string;
  profileId: string;
  active: boolean;
  createdAt: Date;
  lastRunAt: Date | null;
  lastMatchAt: Date | null;
  pausedAt: Date | null;
  snoozedUntil: Date | null;
}

export type NewWatch = Omit<
  Watch,
  | "id"
  | "createdAt"
  | "lastRunAt"
  | "lastMatchAt"
  | "pausedAt"
  | "snoozedUntil"
  | "active"
>;

export function nextRunAt(watch: Watch, now: Date): Date | null {
  if (!watch.active || watch.pausedAt) return null;
  if (!watch.lastRunAt) return now;
  return new Date(watch.lastRunAt.getTime() + watch.intervalHours * HOUR_MS);
}

export function isDue(watch: Watch, now: Date): boolean {
  if (!watch.active || watch.pausedAt) return false;
  if (watch.snoozedUntil && watch.snoozedUntil > now) return false;
  const next = nextRunAt(watch, now);
  return next !== null && next <= now;
}

/** In series mode one episode is one identity, however many files carry it. */
export function identityFor(watch: Watch, release: Release): string {
  const { seasons, episodes, title } = release.parsed;
  if (watch.seriesMode && episodes.length > 0) {
    const season = seasons[0] ?? 0;
    return `series:${title.toLowerCase()}|s${season}e${episodes[0]}`;
  }
  return release.key;
}

/** Below the start mark (e.g. S04E07) is history, not news. */
export function seriesAccepts(watch: Watch, release: Release): boolean {
  if (!watch.seriesMode || !watch.seriesFrom) return true;
  const { seasons, episodes } = release.parsed;
  if (episodes.length === 0) return false;
  const season = seasons[0] ?? 0;
  const episode = episodes[0] ?? 0;
  const from = watch.seriesFrom;
  return (
    season > from.season || (season === from.season && episode >= from.episode)
  );
}

/** "indexed-after": only packs the source first saw after the watch existed. */
export function newnessAccepts(watch: Watch, release: Release): boolean {
  if (watch.newness === "unseen") return true;
  if (!release.firstSeenAt) return true; // source has no timestamp; our sighting decides
  return (
    release.firstSeenAt.getTime() >=
    watch.createdAt.getTime() - NEWNESS_GRACE_MS
  );
}

export function channelsFor(
  mode: NotifyMode,
): ("desktop" | "phone")[] | undefined {
  switch (mode) {
    case "inbox":
      return [];
    case "phone":
    case "urgent":
      return ["desktop", "phone"];
    default:
      return undefined;
  }
}

export function severityFor(mode: NotifyMode): "action" | "urgent" {
  return mode === "urgent" ? "urgent" : "action";
}

export function shouldAutoPause(watch: Watch, now: Date): boolean {
  if (!watch.autoPauseDays) return false;
  const since = watch.lastMatchAt ?? watch.createdAt;
  return now.getTime() - since.getTime() > watch.autoPauseDays * DAY_MS;
}

export const NEWNESS_RULES: readonly NewnessRule[] = [
  "indexed-after",
  "unseen",
];
export const NOTIFY_MODES: readonly NotifyMode[] = [
  "default",
  "inbox",
  "phone",
  "urgent",
];

export interface WatchDefaults {
  filter: ReleaseFilter;
  sources: SourceId[];
  preferredNetworks: string[];
  intervalHours: number;
  newness: NewnessRule;
}
