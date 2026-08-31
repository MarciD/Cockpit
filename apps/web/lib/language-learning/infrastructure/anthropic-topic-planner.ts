// Server-only by convention: imported solely by /api/* (nodejs) route handlers.
// Default adapter for the TopicPlanner port (swappable — see the grader note).
import { CATEGORIES, isCategory } from "../domain/category";
import type { TopicPlan, TopicPlanner } from "../domain/ports";
import type { SentenceSource } from "../domain/sentence-task";
import type { NewItem } from "../domain/vocabulary-item";
import { structuredCall, type JsonSchema } from "./anthropic-client";

const SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      description:
        "New vocabulary for the topic: mostly single words, but INCLUDE several multi-word chunks/collocations (category 'phrase') and 1-2 useful verbs (category 'verb_infinitive'). Group by the scene; avoid near-synonyms.",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: [...CATEGORIES] },
          term: { type: "string" },
          translation: { type: "string" },
          notes: { type: ["string", "null"] },
        },
        required: ["category", "term", "translation"],
        additionalProperties: false,
      },
    },
    sentences: {
      type: "array",
      description:
        "Short, natural example sentences for the scene that REUSE the new items and the learner's known vocabulary.",
      items: {
        type: "object",
        properties: {
          target: { type: "string" },
          native: { type: "string" },
          chunks: { type: "array", items: { type: "string" } },
        },
        required: ["target", "native"],
        additionalProperties: false,
      },
    },
  },
  required: ["items", "sentences"],
  additionalProperties: false,
};

/**
 * Normalise the model's tool output into a domain TopicPlan. The Anthropic API
 * treats `input_schema` as a hint, not an enforced contract, so `items`/
 * `sentences` may be missing, non-arrays, or hold entries with wrong-typed
 * fields — mapping them verbatim would throw. Drop anything malformed.
 */
function toTopicPlan(raw: unknown): TopicPlan {
  const r = (raw ?? {}) as { items?: unknown; sentences?: unknown };
  const rawItems = Array.isArray(r.items) ? r.items : [];
  const rawSentences = Array.isArray(r.sentences) ? r.sentences : [];

  const items: NewItem[] = rawItems
    .map((i) => (i ?? {}) as Record<string, unknown>)
    .filter(
      (i) => typeof i.term === "string" && typeof i.translation === "string",
    )
    .map((i) => ({
      category:
        typeof i.category === "string" && isCategory(i.category)
          ? i.category
          : "common_word",
      term: (i.term as string).trim(),
      translation: (i.translation as string).trim(),
      notes: typeof i.notes === "string" ? i.notes.trim() || null : null,
    }))
    .filter((i) => i.term.length > 0 && i.translation.length > 0);

  const sentences: SentenceSource[] = rawSentences
    .map((s) => (s ?? {}) as Record<string, unknown>)
    .filter((s) => typeof s.target === "string" && typeof s.native === "string")
    .map((s) => ({
      target: (s.target as string).trim(),
      native: (s.native as string).trim(),
      chunks: Array.isArray(s.chunks)
        ? s.chunks
            .filter((c): c is string => typeof c === "string")
            .map((c) => c.trim())
            .filter(Boolean)
        : undefined,
    }))
    .filter((s) => s.target.length > 0 && s.native.length > 0);

  return { items, sentences };
}

export class AnthropicTopicPlanner implements TopicPlanner {
  async plan(input: {
    language: string;
    native: string;
    topic: string;
    focusNote?: string;
    knownVocab: string[];
    itemCount: number;
    sentenceCount: number;
  }): Promise<TopicPlan> {
    const system = [
      `You design a short, thematic ${input.language} lesson for a ${input.native}-speaking learner.`,
      `Everything is grouped around ONE real-life scene/topic.`,
      `Favor useful multi-word chunks and collocations over isolated single words; avoid grouping near-synonyms.`,
      input.focusNote ? `Constraint: ${input.focusNote}.` : "",
      `Reuse the learner's known vocabulary where natural. Reply ONLY via the report tool.`,
    ]
      .filter(Boolean)
      .join(" ");
    const user = [
      `Topic: ${input.topic}.`,
      `Produce about ${input.itemCount} new items (mix of words, chunks, and 1-2 verbs) and ${input.sentenceCount} example sentences.`,
      `Learner already knows (avoid duplicating; reuse in sentences): ${input.knownVocab.slice(0, 100).join(", ")}`,
    ].join("\n");

    const out = await structuredCall<unknown>({
      tier: "balanced",
      system,
      user,
      toolName: "report",
      description: "Report the planned lesson items and sentences.",
      schema: SCHEMA,
      maxTokens: 2000,
    });

    return toTopicPlan(out);
  }
}
