// Server-only by convention: imported solely by /api/* (nodejs) route handlers.
import Anthropic from "@anthropic-ai/sdk";
import { getProviderConfig } from "@/lib/credentials";

// Model tiers mirror the assistant route (apps/web/app/api/assistant/route.ts).
export const MODELS = {
  fast: "claude-haiku-4-5",
  balanced: "claude-sonnet-5",
  deep: "claude-opus-4-8",
} as const;
export type ModelTier = keyof typeof MODELS;

/** JSON Schema shape the Messages API accepts for a tool's input. */
export type JsonSchema = Anthropic.Tool.InputSchema;

/** Thrown when the shared `anthropic` credential is not connected. */
export class LlmNotConfiguredError extends Error {
  constructor() {
    super("Anthropic API key not connected");
    this.name = "LlmNotConfiguredError";
  }
}

async function getClient(): Promise<Anthropic> {
  const cfg = await getProviderConfig<{ apiKey: string }>("anthropic");
  if (!cfg?.apiKey) throw new LlmNotConfiguredError();
  return new Anthropic({ apiKey: cfg.apiKey });
}

/**
 * One-shot structured output: force a single tool call and return its validated
 * input. Cheaper and more reliable than parsing free-text JSON.
 */
export async function structuredCall<T>(params: {
  tier: ModelTier;
  system: string;
  user: string;
  toolName: string;
  description: string;
  schema: JsonSchema;
  maxTokens?: number;
}): Promise<T> {
  const client = await getClient();
  const res = await client.messages.create({
    model: MODELS[params.tier],
    max_tokens: params.maxTokens ?? 1024,
    system: params.system,
    tools: [
      {
        name: params.toolName,
        description: params.description,
        input_schema: params.schema,
      },
    ],
    tool_choice: { type: "tool", name: params.toolName },
    messages: [{ role: "user", content: params.user }],
  });
  const block = res.content.find((c) => c.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Model returned no structured output");
  }
  return block.input as T;
}
