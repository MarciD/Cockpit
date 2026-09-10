import { z } from "zod";

/**
 * `feeds` is one string because the generated settings form has no list
 * editor; the widget and the route split it themselves.
 */
export const configSchema = z.object({
  feeds: z.string(),
  limit: z.number(),
});

export type NewsConfig = z.infer<typeof configSchema>;

export const defaultConfig: NewsConfig = {
  feeds: "https://hnrss.org/frontpage",
  limit: 8,
};

export const MAX_LIMIT = 30;

export function splitFeeds(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((f) => f.trim())
    .filter(Boolean);
}
