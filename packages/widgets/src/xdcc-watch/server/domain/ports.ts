import type { SourceId } from "../../types";
import type { Offer, Pack, Parsed } from "./release";
import type { NewWatch, Watch } from "./watch";

/**
 * What the filter wants, phrased so an indexer can narrow its page upstream
 * when its API allows: a single resolution ("1080p") and the word a filename
 * carries for the single wanted language ("german"). Hints only — the local
 * re-check stays authoritative, and an indexer ignores what it cannot honour.
 */
export interface IndexerHints {
  resolution: string | null;
  languageWord: string | null;
}

export interface IndexerQuery {
  query: string;
  /** Upper bound; each indexer clamps to its own page maximum. */
  limit: number;
  hints: IndexerHints;
}

export interface IndexerPage {
  packs: Pack[];
  /** How many packs the source says it has for this query, if it says. */
  total: number | null;
}

export interface Indexer {
  readonly id: SourceId;
  search(query: IndexerQuery): Promise<IndexerPage>;
}

export interface ArtworkProvider {
  poster(parsed: Parsed, filename: string): Promise<string | null>;
}

export interface WatchRepository {
  list(profileId: string): Watch[];
  listActive(): Watch[];
  get(id: string): Watch | undefined;
  insert(value: NewWatch, id: string, createdAt: Date): Watch;
  update(id: string, patch: Partial<Watch>): void;
  remove(id: string): void;
}

export interface SeenRow {
  watchId: string;
  key: string;
  headline: string;
  firstSeenAt: Date;
  offers: Offer[];
  notifiedAt: Date | null;
  seenByUserAt: Date | null;
}

export interface SeenRepository {
  keys(watchId: string): Set<string>;
  insertMany(rows: SeenRow[]): void;
  listUnseen(profileId: string, watchId?: string): SeenRow[];
  countUnseen(watchId: string): number;
  markSeen(profileId: string, watchId?: string): void;
}

export interface Clock {
  now(): Date;
}
