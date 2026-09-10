// Server-only by convention: imported solely by /api/* (nodejs) route handlers.
import { randomUUID } from "node:crypto";
import {
  deleteVocabItem,
  insertVocabItems,
  listVocabItems,
  recordVocabAnswer,
  updateVocabItem,
  type CockpitDb,
} from "@cockpit/db";
import { isCategory } from "../domain/category";
import type {
  ItemSource,
  NewItem,
  VocabularyItem,
} from "../domain/vocabulary-item";
import type { VocabularyRepository } from "../domain/ports";

type Row = ReturnType<typeof listVocabItems>[number];

function toDomain(row: Row): VocabularyItem {
  return {
    id: row.id,
    language: row.language,
    category: isCategory(row.category) ? row.category : "common_word",
    term: row.term,
    translation: row.translation,
    notes: row.notes ?? null,
    topic: row.topic ?? null,
    source: (row.source as ItemSource) ?? "csv",
    progress: {
      seen: row.seen,
      correct: row.correct,
      itemStreak: row.itemStreak,
      lastSeenAt: row.lastSeenAt ? row.lastSeenAt.getTime() : null,
    },
  };
}

/** Drizzle-backed adapter for the VocabularyRepository port. */
export class DrizzleVocabularyRepository implements VocabularyRepository {
  constructor(private readonly db: CockpitDb) {}

  async all(profileId: string, language: string): Promise<VocabularyItem[]> {
    return listVocabItems(this.db, profileId, language).map(toDomain);
  }

  async insertMany(
    profileId: string,
    language: string,
    items: NewItem[],
    source: ItemSource,
    topic?: string | null,
  ): Promise<number> {
    const rows = items.map((i) => ({
      id: randomUUID(),
      profileId,
      language,
      category: i.category,
      term: i.term,
      translation: i.translation,
      notes: i.notes ?? null,
      topic: topic ?? null,
      source,
    }));
    insertVocabItems(this.db, rows);
    return rows.length;
  }

  async recordAnswer(id: string, correct: boolean): Promise<void> {
    recordVocabAnswer(this.db, id, correct);
  }

  async update(
    id: string,
    patch: Partial<
      Pick<VocabularyItem, "category" | "term" | "translation" | "notes">
    >,
  ): Promise<void> {
    updateVocabItem(this.db, id, patch);
  }

  async remove(id: string): Promise<void> {
    deleteVocabItem(this.db, id);
  }
}
