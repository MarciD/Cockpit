import type { Category } from "./category";
import type { Grade } from "./grade";
import type { Hint } from "./hint";
import type { ScoreState } from "./scoring";
import type { SentenceSource } from "./sentence-task";
import type { ItemSource, NewItem, VocabularyItem } from "./vocabulary-item";

/**
 * The domain's ports (hexagonal). Application services depend only on these
 * interfaces; infrastructure supplies the adapters. This is what keeps the LLM
 * backend and the persistence swappable without touching domain/application.
 */

export interface VocabularyRepository {
  all(profileId: string, language: string): Promise<VocabularyItem[]>;
  /** Insert new rows; returns how many were inserted. */
  insertMany(
    profileId: string,
    language: string,
    items: NewItem[],
    source: ItemSource,
    topic?: string | null,
  ): Promise<number>;
  recordAnswer(id: string, correct: boolean): Promise<void>;
  update(
    id: string,
    patch: Partial<
      Pick<VocabularyItem, "category" | "term" | "translation" | "notes">
    >,
  ): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface SessionInput {
  profileId: string;
  language: string;
  itemsAnswered: number;
  correct: number;
  mode: string;
}

export interface SessionRecord extends SessionInput {
  id: string;
  at: number; // epoch ms
}

export interface SessionRepository {
  append(session: SessionInput): Promise<void>;
  since(
    profileId: string,
    language: string,
    since: Date,
  ): Promise<SessionRecord[]>;
}

export interface ScoreRepository {
  get(profileId: string, language: string): Promise<ScoreState | null>;
  save(profileId: string, language: string, state: ScoreState): Promise<void>;
}

/** LLM port: produce a contextual hint (example sentence + explanation). */
export interface Hinter {
  hint(input: {
    language: string;
    native: string;
    term: string;
    translation: string;
    notes?: string | null;
    category: string;
  }): Promise<Hint>;
}

/** LLM port: grade one free-text sentence answer. */
export interface SentenceGrader {
  grade(input: {
    language: string;
    native: string;
    prompt: string;
    answer: string;
    knownVocab: string[];
  }): Promise<Grade>;
}

export interface ConjugationTable {
  verb: string;
  translation: string;
  tense: string;
  forms: Array<{ person: string; form: string }>;
}

/** The content the LLM plans for a topic session. */
export interface TopicPlan {
  items: NewItem[]; // new words + multi-word chunks (incl. verb_infinitive)
  sentences: SentenceSource[];
}

/** LLM port: plan a thematic session (chunk-rich, reusing known vocab). */
export interface TopicPlanner {
  plan(input: {
    language: string;
    native: string;
    topic: string;
    focusNote?: string;
    knownVocab: string[];
    itemCount: number;
    sentenceCount: number;
  }): Promise<TopicPlan>;
}

/** Cache port for generated conjugation tables (offline/free after first fetch). */
export interface ConjugationCache {
  get(language: string, verb: string): Promise<ConjugationTable | null>;
  put(language: string, verb: string, table: ConjugationTable): Promise<void>;
}

/** LLM port: generate new vocabulary / a conjugation table. */
export interface ItemGenerator {
  generate(input: {
    language: string;
    native: string;
    topic: string;
    mode: string;
    focusNote?: string;
    knownVocab: string[];
    count: number;
  }): Promise<NewItem[]>;
  conjugate(input: {
    language: string;
    native: string;
    verb: string;
    focusNote?: string;
  }): Promise<ConjugationTable>;
}

export type { Category, NewItem, VocabularyItem, Grade, Hint, ScoreState };
