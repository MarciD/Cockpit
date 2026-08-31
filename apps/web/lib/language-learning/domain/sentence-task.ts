/**
 * Sentence tasks for the "produce" phase. Pure builders that turn a target
 * sentence into recognition tasks (reorder / cloze — offline, scaffolded) and a
 * production task (write it yourself — graded by the LLM). Research: sequence
 * recognition → production, with scaffolding that fades.
 */

/** A sentence the planner produced: target text + native gloss + key chunks. */
export interface SentenceSource {
  target: string;
  native: string;
  chunks?: string[];
}

export interface ReorderTask {
  kind: "reorder";
  tokens: string[]; // shuffled
  answer: string; // the correct sentence
  native: string;
}

export interface SentenceClozeTask {
  kind: "sentence_cloze";
  prompt: string; // sentence with one blank "____"
  answer: string; // the removed word
  full: string;
  native: string;
}

export interface ProductionTask {
  kind: "produce";
  native: string; // the prompt: say this in the target language
  target: string; // a reference answer (not shown; LLM grades freely)
  chunks: string[]; // key chunks to reuse
}

export type SentenceTask = ReorderTask | SentenceClozeTask | ProductionTask;

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
  "a",
  "en",
  "de",
  "y",
]);

export function tokenize(sentence: string): string[] {
  return sentence.trim().split(/\s+/).filter(Boolean);
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildReorder(
  src: SentenceSource,
  rng: () => number,
): ReorderTask {
  const tokens = tokenize(src.target);
  let shuffled = shuffle(tokens, rng);
  // Avoid handing back the already-correct order for multi-word sentences.
  if (tokens.length > 1 && shuffled.join(" ") === tokens.join(" ")) {
    shuffled = [...shuffled.slice(1), shuffled[0]];
  }
  return {
    kind: "reorder",
    tokens: shuffled,
    answer: src.target,
    native: src.native,
  };
}

export function buildSentenceCloze(
  src: SentenceSource,
  rng: () => number,
): SentenceClozeTask {
  const tokens = tokenize(src.target);
  const candidates = tokens
    .map((w, i) => ({ w, i }))
    .filter(
      ({ w }) =>
        w.replace(/[^\p{L}]/gu, "").length >= 3 &&
        !ARTICLES.has(w.toLowerCase().replace(/[^\p{L}]/gu, "")),
    );
  const pick =
    candidates.length > 0
      ? candidates[Math.floor(rng() * candidates.length)]
      : { w: tokens[0] ?? src.target, i: 0 };
  const bare = pick.w.replace(/[^\p{L}]/gu, "");
  const prompt = tokens.map((w, i) => (i === pick.i ? "____" : w)).join(" ");
  return {
    kind: "sentence_cloze",
    prompt,
    answer: bare,
    full: src.target,
    native: src.native,
  };
}

export function buildProduction(src: SentenceSource): ProductionTask {
  return {
    kind: "produce",
    native: src.native,
    target: src.target,
    chunks: src.chunks ?? [],
  };
}

/**
 * Turn sentence sources into a scaffolded sequence: the first half as
 * recognition (reorder / cloze, alternating), the rest as production.
 */
export function buildSentenceTasks(
  sources: SentenceSource[],
  rng: () => number,
): SentenceTask[] {
  const recognitionCount = Math.ceil(sources.length / 2);
  return sources.map((src, i) => {
    if (i >= recognitionCount) return buildProduction(src);
    return i % 2 === 0 ? buildReorder(src, rng) : buildSentenceCloze(src, rng);
  });
}
