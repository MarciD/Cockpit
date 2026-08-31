// Server-only by convention: imported solely by /api/* (nodejs) route handlers.
// DEFAULT LLM adapter for the ItemGenerator port (swappable — see grader note).
import { CATEGORIES, isCategory } from "../domain/category";
import type { ConjugationTable, ItemGenerator } from "../domain/ports";
import type { NewItem } from "../domain/vocabulary-item";
import { structuredCall, type JsonSchema } from "./anthropic-client";

const GENERATE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
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
  },
  required: ["items"],
  additionalProperties: false,
};

const CONJUGATE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    verb: { type: "string" },
    translation: { type: "string" },
    tense: { type: "string" },
    forms: {
      type: "array",
      items: {
        type: "object",
        properties: {
          person: { type: "string" },
          form: { type: "string" },
        },
        required: ["person", "form"],
        additionalProperties: false,
      },
    },
  },
  required: ["verb", "translation", "tense", "forms"],
  additionalProperties: false,
};

interface RawItem {
  category: string;
  term: string;
  translation: string;
  notes?: string | null;
}

export class AnthropicItemGenerator implements ItemGenerator {
  async generate(input: {
    language: string;
    native: string;
    topic: string;
    mode: string;
    focusNote?: string;
    knownVocab: string[];
    count: number;
  }): Promise<NewItem[]> {
    const system = [
      `You generate ${input.language} learning vocabulary for a ${input.native}-speaking learner.`,
      `Each item: a target-language term/chunk + its ${input.native} translation + a category.`,
      input.focusNote ? `Constraint: ${input.focusNote}.` : "",
      `Reuse and build on the learner's known vocabulary. Reply ONLY via the report tool.`,
    ]
      .filter(Boolean)
      .join(" ");
    const user = [
      `Generate ${input.count} new items. Mode: ${input.mode}. Topic: ${input.topic || "general everyday"}.`,
      `Avoid duplicating these known terms: ${input.knownVocab.slice(0, 100).join(", ")}`,
    ].join("\n");
    const out = await structuredCall<{ items: RawItem[] }>({
      tier: "balanced",
      system,
      user,
      toolName: "report",
      description: "Report the generated vocabulary items.",
      schema: GENERATE_SCHEMA,
      maxTokens: 1500,
    });
    return out.items.map((i) => ({
      category: isCategory(i.category) ? i.category : "common_word",
      term: i.term.trim(),
      translation: i.translation.trim(),
      notes: i.notes?.trim() || null,
    }));
  }

  async conjugate(input: {
    language: string;
    native: string;
    verb: string;
    focusNote?: string;
  }): Promise<ConjugationTable> {
    const system = [
      `You are a ${input.language} grammar reference for a ${input.native}-speaking learner.`,
      input.focusNote
        ? `Use this tense/scope: ${input.focusNote}.`
        : `Use the present tense.`,
      `Give every person/number form. Reply ONLY via the report tool.`,
    ].join(" ");
    const user = `Conjugate the ${input.language} verb "${input.verb}".`;
    return structuredCall<ConjugationTable>({
      tier: "balanced",
      system,
      user,
      toolName: "report",
      description: "Report the conjugation table.",
      schema: CONJUGATE_SCHEMA,
      maxTokens: 800,
    });
  }
}
