/** DTOs shared by tile, page and server routes. Framework-free. */

export type SourceId = "xdccinfo" | "xdccsearch" | "nibl";
export const SOURCE_IDS: readonly SourceId[] = [
  "xdccinfo",
  "xdccsearch",
  "nibl",
];

export type MatchMode = "all" | "phrase" | "regex";

export interface ReleaseFilter {
  match: MatchMode;
  must: string[];
  mustNot: string[];
  /** e.g. ["1080p"]; empty = any */
  resolutions: string[];
  /** "German", "English", "dual" …; empty = any */
  languages: string[];
  qualities: string[];
  codecs: string[];
  groups: string[];
  excludeGroups: string[];
  minSizeMb: number | null;
  maxSizeGb: number | null;
  seenWithinHours: number | null;
}

export interface ParsedDto {
  title: string;
  year: string | null;
  seasons: number[];
  episodes: number[];
  resolution: string | null;
  quality: string | null;
  codec: string | null;
  group: string | null;
  languages: string[];
  dual: boolean;
}

export interface OfferDto {
  source: SourceId;
  network: string;
  channel: string | null;
  bot: string;
  pack: number;
  filename: string;
  sizeBytes: number | null;
  gets: number | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  command: string;
}

export interface ReleaseDto {
  key: string;
  headline: string;
  parsed: ParsedDto;
  offers: OfferDto[];
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  poster: string | null;
}

export interface SourceStatusDto {
  id: SourceId;
  ok: boolean;
  count: number;
  error: string | null;
  cachedAt: string | null;
}

export interface SearchResponseDto {
  releases: ReleaseDto[];
  sources: SourceStatusDto[];
  /** Releases the filter removed, so the UI can say "3 hidden by defaults". */
  hidden: number;
}

export type NewnessRule = "indexed-after" | "unseen";
export type NotifyMode = "default" | "inbox" | "phone" | "urgent";

export interface WatchSettings {
  label: string;
  query: string;
  filter: ReleaseFilter;
  sources: SourceId[];
  preferredNetworks: string[];
  intervalHours: number;
  seriesMode: boolean;
  seriesFrom: { season: number; episode: number } | null;
  newness: NewnessRule;
  notifyMode: NotifyMode;
  digest: boolean;
  commandInBody: boolean;
  oneShot: boolean;
  autoPauseDays: number | null;
}

export interface WatchDto extends WatchSettings {
  id: string;
  profileId: string;
  active: boolean;
  createdAt: string;
  lastRunAt: string | null;
  lastMatchAt: string | null;
  nextRunAt: string | null;
  pausedAt: string | null;
  snoozedUntil: string | null;
  newCount: number;
}

export interface NewReleaseDto {
  watchId: string;
  key: string;
  headline: string;
  firstSeenAt: string;
  offers: OfferDto[];
  notifiedAt: string | null;
}

/** What `GET defaults` returns: the desk's widget settings turned into search defaults. */
export interface DefaultsDto {
  filter: ReleaseFilter;
  sources: SourceId[];
  preferredNetworks: string[];
  intervalHours: number;
  newness: NewnessRule;
  artwork: boolean;
  showCommands: boolean;
  resultsPerSource: number;
}
