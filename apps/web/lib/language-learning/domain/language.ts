/**
 * Language is a parameter, never a hardcoded assumption — the whole domain is
 * language-agnostic. A widget instance carries a target `language` and the
 * learner's `native` language; both are opaque strings used for scoping (as a
 * stable key) and for prompting the LLM (as a display name).
 */
export interface Language {
  /** Target language as the user entered it, e.g. "Spanish" or "es". */
  target: string;
  /** The learner's language the vocabulary is translated into, e.g. "German". */
  native: string;
}

/** Stable scoping key for a language string (trim only — preserves display). */
export function languageKey(input: string): string {
  return input.trim();
}
