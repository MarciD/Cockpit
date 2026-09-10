import { assertPublicHttpUrl, BlockedUrlError } from "@cockpit/integrations";
import {
  badRequest,
  json,
  type CachedResult,
  type WidgetRoutes,
} from "../../server/contract";
import { MAX_LIMIT } from "../config";
import type { NewsItem } from "../types";
import { getNews } from "./infrastructure/rss";

const TEN_MIN_MS = 10 * 60_000;

type CachedFetch = <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs?: number,
  force?: boolean,
) => Promise<CachedResult<T>>;

export function buildRoutes(cachedFetch: CachedFetch): WidgetRoutes {
  return {
    "GET ": async (_req, ctx) => {
      const sp = ctx.url.searchParams;
      const feeds = sp.getAll("feed").filter(Boolean);
      if (feeds.length === 0)
        return badRequest("at least one feed is required");
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, Number(sp.get("limit")) || 8),
      );

      // Feed URLs come straight from widget config, i.e. from the client.
      try {
        for (const feed of feeds) assertPublicHttpUrl(feed, "The feed URL");
      } catch (err: unknown) {
        if (err instanceof BlockedUrlError) return badRequest(err.message);
        throw err;
      }

      const key = `news:${[...feeds].sort().join("|")}:${limit}`;
      const payload = await cachedFetch<NewsItem[]>(
        key,
        () => getNews({ feeds, limit }),
        TEN_MIN_MS,
        sp.get("refresh") === "1",
      );
      return json({ configured: true, ...payload });
    },
  };
}
