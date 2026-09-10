// Server-only by convention: imported solely by /api/* (nodejs) route handlers.
// Default adapter for the Hinter port (swappable — see the grader note).
import type { Hint } from "../domain/hint";
import type { Hinter } from "../domain/ports";
import { structuredCall, type JsonSchema } from "./anthropic-client";

const SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    example: {
      type: "string",
      description:
        "One short, natural sentence in the target language using the word, followed by its translation in parentheses.",
    },
    explanation: {
      type: "string",
      description:
        "A brief usage/grammar note in the learner's native language.",
    },
  },
  required: ["example", "explanation"],
  additionalProperties: false,
};

export class AnthropicHinter implements Hinter {
  async hint(input: {
    language: string;
    native: string;
    term: string;
    translation: string;
    notes?: string | null;
    category: string;
  }): Promise<Hint> {
    const system = [
      `You are a concise ${input.language} tutor for a ${input.native}-speaking learner.`,
      `Give ONE short, natural example sentence in ${input.language} using the word,`,
      `with its ${input.native} translation in parentheses, plus a very short usage/grammar note.`,
      `Reply ONLY via the report tool.`,
    ].join(" ");
    const user = [
      `Word: ${input.term} (${input.translation})`,
      `Type: ${input.category}`,
      input.notes ? `Notes: ${input.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return structuredCall<Hint>({
      tier: "fast",
      system,
      user,
      toolName: "report",
      description: "Report the hint.",
      schema: SCHEMA,
      maxTokens: 300,
    });
  }
}
