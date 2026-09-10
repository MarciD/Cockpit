// Server-only by convention: imported solely by /api/* (nodejs) route handlers.
// DEFAULT LLM adapter. SentenceGrader is a port — an OSS contributor can drop in
// a local (e.g. Ollama) or no-LLM adapter without touching domain/application.
import type { Grade } from "../domain/grade";
import type { SentenceGrader } from "../domain/ports";
import { structuredCall, type JsonSchema } from "./anthropic-client";

const SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    correct: { type: "boolean" },
    mainError: {
      type: ["string", "null"],
      description:
        "The single most important correction (grammar/vocabulary/word order), or null if the answer is essentially correct.",
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description:
        "Soft notes such as missing accents/diacritics or pronoun choice — NEVER the main error.",
    },
    corrected: {
      type: ["string", "null"],
      description:
        "A corrected version of the answer, or null if already correct.",
    },
  },
  required: ["correct", "mainError", "warnings", "corrected"],
  additionalProperties: false,
};

/**
 * Coerce the model's tool output into a valid Grade. The Anthropic API treats
 * `input_schema` as a hint, not an enforced contract — the fast tier (Haiku)
 * occasionally omits `warnings` or returns a non-array/null. Trusting it verbatim
 * crashes the client (`grade.warnings.map`), so normalise at this boundary.
 */
function toGrade(raw: unknown): Grade {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    correct: r.correct === true,
    mainError: typeof r.mainError === "string" ? r.mainError : null,
    warnings: Array.isArray(r.warnings)
      ? r.warnings.filter((w): w is string => typeof w === "string")
      : [],
    corrected: typeof r.corrected === "string" ? r.corrected : null,
  };
}

export class AnthropicSentenceGrader implements SentenceGrader {
  async grade(input: {
    language: string;
    native: string;
    prompt: string;
    answer: string;
    knownVocab: string[];
  }): Promise<Grade> {
    const system = [
      `You are a concise ${input.language} coach for a ${input.native}-speaking learner.`,
      `Grade the learner's answer to the given task.`,
      `RULES: diacritics/accents and pronoun choice are WARNINGS, never the mainError.`,
      `mainError = the single most important correction (grammar, vocabulary, word order), or null if essentially correct.`,
      `Keep warnings short. Prefer the learner's known vocabulary. Reply ONLY via the report tool.`,
    ].join(" ");
    const user = [
      `Task/prompt: ${input.prompt}`,
      `Learner's answer: ${input.answer}`,
      `Known vocabulary (reuse when relevant): ${input.knownVocab.slice(0, 80).join(", ")}`,
    ].join("\n");
    const raw = await structuredCall<unknown>({
      tier: "fast", // Haiku — cheap, sufficient for grading
      system,
      user,
      toolName: "report",
      description: "Report the grading result.",
      schema: SCHEMA,
      maxTokens: 512,
    });
    return toGrade(raw);
  }
}
