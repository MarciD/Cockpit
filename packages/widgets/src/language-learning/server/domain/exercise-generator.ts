import type { Category } from "./category";
import type { Exercise, PracticeMode } from "./exercise";
import { accuracy, type VocabularyItem } from "./vocabulary-item";

/**
 * Pure, language-agnostic exercise generation. Randomness is injected (`rng`)
 * and the clock is passed in (`now`) so the whole module stays deterministic
 * and testable — no Math.random / Date.now here.
 */
export interface GenerateParams {
  items: VocabularyItem[];
  mode: PracticeMode;
  count: number;
  now: number; // epoch ms
  rng: () => number; // [0,1)
}

const MODE_CATEGORIES: Record<PracticeMode, readonly Category[]> = {
  words: ["noun", "common_word", "time_word"],
  verbs: ["verb_infinitive"],
  level: ["phrase", "time_phrase", "grammar", "verb_infinitive"],
  general: [
    "noun",
    "verb_infinitive",
    "grammar",
    "common_word",
    "phrase",
    "time_word",
    "time_phrase",
  ],
};

const MIN_MC_POOL = 3; // need at least 3 distractors for a 4-option question

/** Higher weight → more likely to be practiced. Favors weak + stale + new items. */
export function itemWeight(item: VocabularyItem, now: number): number {
  const p = item.progress;
  let w = 1;
  w += (1 - accuracy(p)) * 2; // struggling items
  w += p.seen === 0 ? 2 : 1 / (1 + p.seen); // new / rarely seen
  if (p.lastSeenAt === null) {
    w += 1;
  } else {
    const days = (now - p.lastSeenAt) / 86_400_000;
    w += Math.min(2, days / 3); // staleness, capped
  }
  w -= Math.min(1, p.itemStreak * 0.2); // ease off well-known items
  return Math.max(0.1, w);
}

function weightedSampleWithoutReplacement(
  items: VocabularyItem[],
  count: number,
  now: number,
  rng: () => number,
): VocabularyItem[] {
  const pool = [...items];
  const chosen: VocabularyItem[] = [];
  while (chosen.length < count && pool.length > 0) {
    const weights = pool.map((i) => itemWeight(i, now));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= weights[idx] ?? 0;
      if (r <= 0) break;
    }
    const picked = pool[idx];
    if (!picked) break;
    chosen.push(picked);
    pool.splice(idx, 1);
  }
  return chosen;
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

// Articles/stopwords stripped when picking the "content word" of a term.
const ARTICLES = new Set([
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "le",
  "les",
  "der",
  "die",
  "das",
  "the",
  "to",
]);

function contentWord(term: string): string | null {
  const words = term
    .trim()
    .split(/\s+/)
    .map((w) => w.toLowerCase().replace(/[^\p{L}]/gu, ""))
    .filter((w) => w.length >= 3 && !ARTICLES.has(w));
  if (words.length === 0) return null;
  return words.sort((a, b) => b.length - a.length)[0] ?? null;
}

/** A deck phrase that uses this word, as an offline usage example. */
function findExample(
  item: VocabularyItem,
  allItems: VocabularyItem[],
): string | undefined {
  if (item.category === "phrase" || item.category === "time_phrase") {
    return undefined;
  }
  const w = contentWord(item.term);
  if (!w) return undefined;
  const hit = allItems.find(
    (o) =>
      o.id !== item.id &&
      (o.category === "phrase" || o.category === "time_phrase") &&
      o.term.toLowerCase().includes(w),
  );
  return hit ? `${hit.term} — ${hit.translation}` : undefined;
}

/** The instant, offline part of the hint: the item's notes + a deck example. */
function offlineHint(
  item: VocabularyItem,
  allItems: VocabularyItem[],
): { note?: string; example?: string } {
  return {
    note: item.notes?.trim() || undefined,
    example: findExample(item, allItems),
  };
}

function buildExercise(
  item: VocabularyItem,
  sameCategory: VocabularyItem[],
  allItems: VocabularyItem[],
  rng: () => number,
): Exercise {
  const oh = offlineHint(item, allItems);
  const words = item.term.trim().split(/\s+/);

  // Multi-word phrases → cloze (blank a content word).
  if (
    (item.category === "phrase" || item.category === "time_phrase") &&
    words.length >= 2
  ) {
    const candidates = words
      .map((w, i) => ({ w, i }))
      .filter(({ w }) => w.replace(/[^\p{L}]/gu, "").length >= 3);
    const pick = candidates[Math.floor(rng() * candidates.length)] ?? {
      w: words[0] ?? "",
      i: 0,
    };
    const bare = pick.w.replace(/[^\p{L}]/gu, "");
    const blanked = words.map((w, i) => (i === pick.i ? "____" : w)).join(" ");
    return {
      kind: "cloze",
      itemId: item.id,
      category: item.category,
      prompt: blanked,
      answer: bare,
      full: item.term,
      hint: item.translation,
      ...oh,
    };
  }

  // Enough peers → multiple choice (pick the translation of the shown term).
  if (sameCategory.length >= MIN_MC_POOL && rng() < 0.5) {
    const distractors = shuffle(sameCategory, rng)
      .slice(0, 3)
      .map((i) => i.translation);
    const options = shuffle([item.translation, ...distractors], rng);
    return {
      kind: "multiple_choice",
      itemId: item.id,
      category: item.category,
      prompt: item.term,
      options,
      answerIndex: options.indexOf(item.translation),
      ...oh,
    };
  }

  // Default → flashcard, random direction.
  const termToTranslation = rng() < 0.5;
  return {
    kind: "flashcard",
    itemId: item.id,
    category: item.category,
    direction: termToTranslation
      ? "term_to_translation"
      : "translation_to_term",
    prompt: termToTranslation ? item.term : item.translation,
    answer: termToTranslation ? item.translation : item.term,
    ...oh,
  };
}

export function generateBatch(params: GenerateParams): Exercise[] {
  const { items, mode, count, now, rng } = params;
  const allowed = new Set(MODE_CATEGORIES[mode]);
  const eligible = items.filter((i) => allowed.has(i.category));
  const picked = weightedSampleWithoutReplacement(eligible, count, now, rng);
  return picked.map((item) => {
    const sameCategory = eligible.filter(
      (i) => i.category === item.category && i.id !== item.id,
    );
    return buildExercise(item, sameCategory, items, rng);
  });
}
