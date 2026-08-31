/**
 * The vocabulary categories, kept language-neutral (verbatim from the seed CSV).
 * A value object: a small closed set with a guard for untrusted input.
 */
export const CATEGORIES = [
  "noun",
  "verb_infinitive",
  "grammar",
  "common_word",
  "phrase",
  "time_word",
  "time_phrase",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

/** Single-word categories — the ones "words" mode drills (verbs excluded). */
export const WORD_CATEGORIES: readonly Category[] = [
  "noun",
  "common_word",
  "time_word",
];

/** Multi-word categories, suitable for cloze. */
export const PHRASE_CATEGORIES: readonly Category[] = ["phrase", "time_phrase"];
