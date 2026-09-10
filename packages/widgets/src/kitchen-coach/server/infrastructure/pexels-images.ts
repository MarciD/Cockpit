import type { CachedResult } from "../../../server/contract";
import type { ImageProvider } from "../domain/ports";

const ENDPOINT = "https://api.pexels.com/v1/search";
const TIMEOUT_MS = 10_000;
const TTL_MS = 30 * 24 * 60 * 60_000;

export interface PexelsConfig {
  apiKey: string;
}

type CachedFetch = <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs?: number,
  force?: boolean,
) => Promise<CachedResult<T>>;

/**
 * Stock photos, labelled "Symbolbild" in the UI because they are never the
 * dish you cooked. Free with a key (200 requests an hour); Pexels asks for a
 * visible credit, which the recipe footer carries. Without a key: no image,
 * never an error.
 */
export class PexelsImages implements ImageProvider {
  constructor(
    private readonly cachedFetch: CachedFetch,
    private readonly config: () => Promise<PexelsConfig | null>,
  ) {}

  async find(query: string): Promise<string | null> {
    const cfg = await this.config();
    if (!cfg?.apiKey) return null;
    const result = await this.cachedFetch<string | null>(
      `kitchen:image:${query.toLowerCase()}`,
      async () => {
        const url = new URL(ENDPOINT);
        url.searchParams.set("query", `${query} food`);
        url.searchParams.set("per_page", "1");
        url.searchParams.set("orientation", "landscape");
        const res = await fetch(url, {
          headers: { authorization: cfg.apiKey },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`Pexels responded HTTP ${res.status}`);
        const json = (await res.json()) as {
          photos?: { src?: { medium?: string } }[];
        };
        return json.photos?.[0]?.src?.medium ?? null;
      },
      TTL_MS,
    );
    return result.items ?? null;
  }
}
