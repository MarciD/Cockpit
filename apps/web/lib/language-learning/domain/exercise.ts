import type { Category } from "./category";

/** The generic practice modes (language-neutral form of the ChatGPT modes). */
export type PracticeMode = "words" | "verbs" | "level" | "general";
export const PRACTICE_MODES: readonly PracticeMode[] = [
  "words",
  "verbs",
  "level",
  "general",
];

export type ExerciseKind = "flashcard" | "multiple_choice" | "cloze";

interface BaseExercise {
  itemId: string;
  category: Category;
  /** Optional short hint shown alongside the prompt (e.g. the translation). */
  hint?: string;
  /** Offline hint: the item's own notes, if any. */
  note?: string;
  /** Offline hint: an example phrase from the deck that uses this word. */
  example?: string;
}

/** Reveal-and-self-rate: shown one side, recall the other. */
export interface FlashcardExercise extends BaseExercise {
  kind: "flashcard";
  prompt: string;
  answer: string;
  direction: "term_to_translation" | "translation_to_term";
}

/** Pick the right option (distractors from the same category). Auto-graded. */
export interface MultipleChoiceExercise extends BaseExercise {
  kind: "multiple_choice";
  prompt: string;
  options: string[];
  answerIndex: number;
}

/** Fill the blank in a phrase. Auto-graded (case/accent-insensitive by caller). */
export interface ClozeExercise extends BaseExercise {
  kind: "cloze";
  prompt: string; // sentence with the blank as "____"
  answer: string; // the removed word
  full: string; // the complete phrase, for feedback
}

export type Exercise =
  FlashcardExercise | MultipleChoiceExercise | ClozeExercise;
