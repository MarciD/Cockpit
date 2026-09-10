import type { CachedResult } from "../../../server/contract";
import type { ArtworkProvider } from "../domain/ports";
import type { Parsed } from "../domain/release";

const TIMEOUT_MS = 10_000;
const ARTWORK_TTL_MS = 7 * 24 * 60 * 60_000;
const ANILIST = "https://graphql.anilist.co";
const TMDB = "https://api.themoviedb.org/3";
const TMDB_IMAGE = "https://image.tmdb.org/t/p/w342";

export interface TmdbConfig {
  apiKey: string;
}

type CachedFetch = <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs?: number,
  force?: boolean,
) => Promise<CachedResult<T>>;

/** `[Group] Title - 27` is the anime convention; everything else is scene. */
export const looksAnime = (filename: string): boolean =>
  filename.trim().startsWith("[");

async function anilistPoster(title: string): Promise<string | null> {
  const res = await fetch(ANILIST, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      query:
        "query ($s: String) { Media(search: $s, type: ANIME) { coverImage { large } } }",
      variables: { s: title },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`AniList responded HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: { Media?: { coverImage?: { large?: string } } };
  };
  return json.data?.Media?.coverImage?.large ?? null;
}

async function tmdbPoster(
  parsed: Parsed,
  apiKey: string,
): Promise<string | null> {
  const tv = parsed.episodes.length > 0 || parsed.seasons.length > 0;
  const url = new URL(`${TMDB}/search/${tv ? "tv" : "movie"}`);
  url.searchParams.set("query", parsed.title);
  if (parsed.year)
    url.searchParams.set(tv ? "first_air_date_year" : "year", parsed.year);
  url.searchParams.set("api_key", apiKey);
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`TMDB responded HTTP ${res.status}`);
  const json = (await res.json()) as {
    results?: { poster_path?: string | null }[];
  };
  const path = json.results?.[0]?.poster_path;
  return path ? `${TMDB_IMAGE}${path}` : null;
}

/**
 * Posters: AniList (no key) for anime-style names, TMDB (your key) for the
 * rest. Lookups are cached for a week per title; a missing key means no
 * poster, never an error.
 */
export class CachedArtwork implements ArtworkProvider {
  constructor(
    private readonly cachedFetch: CachedFetch,
    private readonly tmdbConfig: () => Promise<TmdbConfig | null>,
  ) {}

  async poster(parsed: Parsed, filename: string): Promise<string | null> {
    const anime = looksAnime(filename);
    if (!anime && !(await this.tmdbConfig())?.apiKey) return null;
    const kind =
      parsed.episodes.length || parsed.seasons.length ? "tv" : "movie";
    const key = `xdcc:art:${anime ? "anilist" : "tmdb"}:${kind}:${parsed.title.toLowerCase()}:${parsed.year ?? ""}`;
    const result = await this.cachedFetch<string | null>(
      key,
      async () => {
        if (anime) return anilistPoster(parsed.title);
        const cfg = await this.tmdbConfig();
        return cfg?.apiKey ? tmdbPoster(parsed, cfg.apiKey) : null;
      },
      ARTWORK_TTL_MS,
    );
    return result.items ?? null;
  }
}
