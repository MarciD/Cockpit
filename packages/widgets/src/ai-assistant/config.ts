import { z } from "zod";

/** Model tier, whether to send the desk's widget summaries, and a house rule. */
export const configSchema = z.object({
  model: z.enum(["fast", "balanced", "deep"]),
  useDeskContext: z.boolean(),
  systemNote: z.string().optional(),
});

export type AssistantConfig = z.infer<typeof configSchema>;

export const defaultConfig: AssistantConfig = {
  model: "balanced",
  useDeskContext: true,
  systemNote: "",
};

export const PROVIDER = "anthropic";
