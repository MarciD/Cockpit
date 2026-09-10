import type { IntentDto } from "../../types";

/**
 * "Avocado schneiden" is a how-to; "Avocado" could be either. A word list
 * decides the clear cases for free; only the genuinely unclear ones are worth
 * a model call, and even then the UI offers both.
 */
const VERBS = [
  "schneiden",
  "würfeln",
  "hacken",
  "filetieren",
  "tranchieren",
  "entkernen",
  "schälen",
  "hobeln",
  "raspeln",
  "reiben",
  "zerlegen",
  "ausnehmen",
  "entgräten",
  "häuten",
  "blanchieren",
  "pochieren",
  "konfieren",
  "sautieren",
  "anbraten",
  "schmoren",
  "dünsten",
  "dämpfen",
  "karamellisieren",
  "emulgieren",
  "aufschlagen",
  "montieren",
  "binden",
  "abschmecken",
  "marinieren",
  "panieren",
  "kneten",
  "falten",
  "temperieren",
  "flambieren",
  "glasieren",
  "reduzieren",
  "klären",
  "ablöschen",
  "abziehen",
  "portionieren",
  "wenden",
  "ruhen",
];
const QUESTIONS = /^(wie|how)\b/i;
const TECHNIQUE_NOUNS =
  /\b(technik|griff|schnitt|messer|maillard|emulsion|garstufe|kerntemperatur)\b/i;

const normalise = (query: string): string => query.trim().toLowerCase();

export function classifyIntent(query: string): IntentDto {
  const q = normalise(query);
  if (!q) return { intent: "ideas", technique: null };

  const verb = VERBS.find((v) => new RegExp(`\\b${v}\\b`).test(q));
  if (verb || QUESTIONS.test(q) || TECHNIQUE_NOUNS.test(q)) {
    return { intent: "technique", technique: query.trim() };
  }

  // One or two words that name a thing: could be "cook with it" or "cut it".
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length <= 2) {
    return { intent: "ambiguous", technique: `${query.trim()} schneiden` };
  }
  return { intent: "ideas", technique: null };
}

/** Cache key for a technique card. */
export function techniqueKey(query: string): string {
  return normalise(query).replace(/\s+/g, " ");
}
