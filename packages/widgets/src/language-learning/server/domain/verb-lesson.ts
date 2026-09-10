import type { ConjugationTable } from "./ports";

/**
 * Pure helpers for the guided verb lesson. Research: present the table briefly,
 * then build retrieval drills (cloze/fill-in per person) — retrieval beats
 * restudy for grammar retention.
 */

/** Longest common (case-insensitive) prefix across the forms ≈ the stem. */
export function stemOf(forms: string[]): string {
  if (forms.length === 0) return "";
  let stem = forms[0] ?? "";
  for (const f of forms.slice(1)) {
    let i = 0;
    while (
      i < stem.length &&
      i < f.length &&
      stem[i]?.toLowerCase() === f[i]?.toLowerCase()
    ) {
      i++;
    }
    stem = stem.slice(0, i);
    if (!stem) break;
  }
  return stem;
}

export interface VerbDrill {
  person: string;
  answer: string; // the correct form
  options: string[]; // for the receptive step (up to 4, incl. the answer)
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const ai = a[i] as T;
    a[i] = a[j] as T;
    a[j] = ai;
  }
  return a;
}

/** One drill per person: distractors are the verb's other forms (confusable). */
export function buildConjugationDrills(
  table: ConjugationTable,
  rng: () => number,
): VerbDrill[] {
  return table.forms.map((f) => {
    const others = table.forms
      .filter((o) => o.form !== f.form)
      .map((o) => o.form);
    const distractors = shuffle(others, rng).slice(0, 3);
    return {
      person: f.person,
      answer: f.form,
      options: shuffle([f.form, ...distractors], rng),
    };
  });
}
