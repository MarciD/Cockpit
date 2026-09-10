import type { SourceId } from "../../types";
import type { Offer, Pack, Parsed } from "./release";
import type { NewWatch, Watch } from "./watch";

export interface Indexer {
  readonly id: SourceId;
  search(query: string, limit: number): Promise<Pack[]>;
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
