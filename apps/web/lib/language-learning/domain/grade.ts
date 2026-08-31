/**
 * The result of grading a free-text answer. Encodes the coach rule: diacritics
 * and pronoun choices are *warnings*, never the headline error.
 */
export interface Grade {
  correct: boolean;
  /** The single most important correction, or null when essentially right. */
  mainError: string | null;
  /** Soft notes (accents, pronouns, style) — never the main error. */
  warnings: string[];
  /** An optional corrected version of the learner's sentence. */
  corrected: string | null;
}
