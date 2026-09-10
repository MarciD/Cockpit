// Client-side DTOs mirroring the widget's JSON contract. The widget package is
// presentation-only and never imports the server-side domain — these are the
// boundary types.

export type Category =
  | "noun"
  | "verb_infinitive"
  | "grammar"
  | "common_word"
  | "phrase"
  | "time_word"
  | "time_phrase";

export const CATEGORIES: readonly Category[] = [
  "noun",
  "verb_infinitive",
  "grammar",
  "common_word",
  "phrase",
  "time_word",
  "time_phrase",
];

export type PracticeMode = "words" | "verbs" | "level" | "general";

export const PRACTICE_MODE_LABELS: Record<PracticeMode, string> = {
  words: "Words",
  verbs: "Verbs",
  level: "Level prep",
  general: "General",
};

interface BaseExercise {
  itemId: string;
  category: Category;
  /** Short inline hint next to the prompt (e.g. the translation). */
  hint?: string;
  /** Offline hint: the item's own notes. */
  note?: string;
  /** Offline hint: a deck phrase that uses the word. */
  example?: string;
}

export interface FlashcardExercise extends BaseExercise {
  kind: "flashcard";
  prompt: string;
  answer: string;
  direction: "term_to_translation" | "translation_to_term";
}

export interface MultipleChoiceExercise extends BaseExercise {
  kind: "multiple_choice";
  prompt: string;
  options: string[];
  answerIndex: number;
}

export interface ClozeExercise extends BaseExercise {
  kind: "cloze";
  prompt: string;
  answer: string;
  full: string;
}

/** On-demand LLM hint (the "+ more from Claude" content). */
export interface Hint {
  example: string;
  explanation: string;
}

export type Exercise =
  FlashcardExercise | MultipleChoiceExercise | ClozeExercise;

export interface ScoreSummary {
  itemsAnswered: number;
  correct: number;
  accuracy: number;
  score: number;
  goalItems: number;
  goalProgress: number;
  goalMet: boolean;
  streakDays: number;
  streakFreezes: number;
  spark: number[];
}

export interface Grade {
  correct: boolean;
  mainError: string | null;
  warnings: string[];
  corrected: string | null;
}

export interface VocabItem {
  id: string;
  language: string;
  category: Category;
  term: string;
  translation: string;
  notes: string | null;
  topic?: string | null;
  source: "csv" | "claude" | "manual";
  progress: {
    seen: number;
    correct: number;
    itemStreak: number;
    lastSeenAt: number | null;
  };
}

export interface ConjugationTable {
  verb: string;
  translation: string;
  tense: string;
  forms: Array<{ person: string; form: string }>;
}

// --- topic sessions + verb lessons ------------------------------------------

export interface Topic {
  slug: string;
  label: string;
}

export interface PlannedItem {
  category: Category;
  term: string;
  translation: string;
  notes?: string | null;
}

export interface SentenceSource {
  target: string;
  native: string;
  chunks?: string[];
}

export interface ReorderTask {
  kind: "reorder";
  tokens: string[];
  answer: string;
  native: string;
}

export interface SentenceClozeTask {
  kind: "sentence_cloze";
  prompt: string;
  answer: string;
  full: string;
  native: string;
}

export interface ProductionTask {
  kind: "produce";
  native: string;
  target: string;
  chunks: string[];
}

export type SentenceTask = ReorderTask | SentenceClozeTask | ProductionTask;

export interface TopicSession {
  topic: string;
  newItems: number;
  plan: {
    topic: string;
    items: PlannedItem[];
    sentences: SentenceSource[];
  };
  tasks: SentenceTask[];
}

export interface VerbDrill {
  person: string;
  answer: string;
  options: string[];
}

export interface VerbLesson {
  table: ConjugationTable;
  stem: string;
  drills: VerbDrill[];
}

/** Local calendar day 'YYYY-MM-DD' — keeps the streak boundary in the user's tz. */
export function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Accent/case-insensitive comparison for auto-graded answers. */
export function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
