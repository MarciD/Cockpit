import type { CachedResult } from "../../../server/contract";
import type { TechniqueVideoDto } from "../../types";
import type { VideoProvider } from "../domain/ports";

const SEARCH = "https://www.googleapis.com/youtube/v3/search";
const TIMEOUT_MS = 10_000;
const TTL_MS = 30 * 24 * 60 * 60_000;
const MAX_RESULTS = 3;

export interface YoutubeConfig {
  apiKey: string;
}

type CachedFetch = <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs?: number,
  force?: boolean,
) => Promise<CachedResult<T>>;

/**
 * Short clips for a technique card: cutting is best seen. A search costs 100
 * of the free 10,000 daily quota units, so results are cached for a month.
 * Without a key the card simply has no videos and the UI offers a link.
 */
export class YoutubeVideos implements VideoProvider {
  constructor(
    private readonly cachedFetch: CachedFetch,
    private readonly config: () => Promise<YoutubeConfig | null>,
  ) {}

  async find(query: string): Promise<TechniqueVideoDto[]> {
    const cfg = await this.config();
    if (!cfg?.apiKey) return [];
    const result = await this.cachedFetch<TechniqueVideoDto[]>(
      `kitchen:video:${query.toLowerCase()}`,
      async () => {
        const url = new URL(SEARCH);
        url.searchParams.set("part", "snippet");
        url.searchParams.set("q", `${query} Küche Technik`);
        url.searchParams.set("type", "video");
        url.searchParams.set("videoDuration", "short");
        url.searchParams.set("relevanceLanguage", "de");
        url.searchParams.set("maxResults", String(MAX_RESULTS));
        url.searchParams.set("key", cfg.apiKey);
        const res = await fetch(url, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`YouTube responded HTTP ${res.status}`);
        const json = (await res.json()) as {
          items?: {
            id?: { videoId?: string };
            snippet?: { title?: string; channelTitle?: string };
          }[];
        };
        const videos: TechniqueVideoDto[] = [];
        for (const item of json.items ?? []) {
          const id = item.id?.videoId;
          if (!id) continue;
          videos.push({
            title: item.snippet?.title ?? "",
            channel: item.snippet?.channelTitle ?? "",
            url: `https://www.youtube.com/watch?v=${id}`,
            // nocookie, so watching a clip does not set a tracking cookie.
            embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
            seconds: null,
          });
        }
        return videos;
      },
      TTL_MS,
    );
    return result.items ?? [];
  }
}
