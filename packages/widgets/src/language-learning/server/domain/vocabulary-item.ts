import type { Category } from "./category";

/** Per-item learning progress (weighted practice — no due dates). */
export interface Progress {
  seen: number;
  correct: number;
  /** Consecutive correct answers — used only for practice weighting. */
  itemStreak: number;
  /** Epoch ms of the last exposure, or null if never practiced. */
  lastSeenAt: number | null;
}

export type ItemSource = "csv" | "claude" | "manual";

/** Aggregate root: one vocabulary entry (word / chunk / phrase / grammar note). */
export interface VocabularyItem {
  id: string;
  language: string;
  category: Category;
  term: string;
  translation: string;
  notes: string | null;
  topic: string | null;
  source: ItemSource;
  progress: Progress;
}

/** A not-yet-persisted item (import / LLM generation / manual add). */
export interface NewItem {
  category: Category;
  term: string;
  translation: string;
  notes?: string | null;
}

export function accuracy(p: Progress): number {
  return p.seen === 0 ? 0 : p.correct / p.seen;
}

/** Normalized key for idempotent import (case/space-insensitive on the term). */
export function termKey(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}
