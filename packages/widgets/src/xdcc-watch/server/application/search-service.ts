import type { CachedResult } from "../../../server/contract";
import type { ReleaseFilter, SourceId, SourceStatusDto } from "../../types";
import { hintsFor, matchesQuery, passesFilter } from "../domain/filter";
import type {
  ArtworkProvider,
  Clock,
  Indexer,
  IndexerHints,
} from "../domain/ports";
import {
  groupReleases,
  sortReleases,
  type Pack,
  type Parsed,
  type Release,
} from "../domain/release";

const SEARCH_TTL_MS = 10 * 60_000;
/** Posters are one extra request per release; only the top of the list gets them. */
const ARTWORK_LIMIT = 12;
/** One page per source and poll; each indexer clamps this to its own maximum. */
export const MAX_PAGE = 200;

export interface SearchRequest {
  query: string;
  filter: ReleaseFilter;
  sources: SourceId[];
  preferredNetworks: string[];
  limit: number;
  force: boolean;
  artwork: boolean;
}

export interface SearchResult {
  releases: Release[];
  posters: Map<string, string | null>;
  sources: SourceStatusDto[];
  hidden: number;
}

type CachedFetch = <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs?: number,
  force?: boolean,
) => Promise<CachedResult<T>>;

/** JSON-safe twin of `Pack` for the cache table. */
type StoredPack = Omit<Pack, "firstSeenAt" | "lastSeenAt"> & {
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

interface StoredPage {
  packs: StoredPack[];
  total: number | null;
}

const store = (p: Pack): StoredPack => ({
  ...p,
  firstSeenAt: p.firstSeenAt?.toISOString() ?? null,
  lastSeenAt: p.lastSeenAt?.toISOString() ?? null,
});

const revive = (p: StoredPack): Pack => ({
  ...p,
  firstSeenAt: p.firstSeenAt ? new Date(p.firstSeenAt) : null,
  lastSeenAt: p.lastSeenAt ? new Date(p.lastSeenAt) : null,
});

const hintKey = (h: IndexerHints) =>
  `${h.resolution ?? "-"}:${h.languageWord ?? "-"}`;

/**
 * One search across the enabled indexers: fetched through the shared cache
 * (ten minutes per source, query and hint, stale data on failure), re-checked
 * against the query locally, grouped by release, filtered, sorted.
 *
 * The filter's single-valued wants travel upstream as hints, so a source
 * that can narrow its page does — otherwise one page of "recently seen"
 * packs is a random slice of the index and the filter empties it.
 */
export class SearchService {
  constructor(
    private readonly indexers: readonly Indexer[],
    private readonly parse: (filename: string) => Parsed,
    private readonly cachedFetch: CachedFetch,
    private readonly artwork: ArtworkProvider,
    private readonly clock: Clock,
  ) {}

  async search(req: SearchRequest): Promise<SearchResult> {
    const query = req.query.trim();
    if (!query)
      return { releases: [], posters: new Map(), sources: [], hidden: 0 };

    const hints = hintsFor(req.filter);
    const limit = Math.min(Math.max(1, req.limit), MAX_PAGE);
    const packs: Pack[] = [];
    const sources: SourceStatusDto[] = [];
    await Promise.all(
      req.sources.map(async (id) => {
        const indexer = this.indexers.find((i) => i.id === id);
        if (!indexer) return;
        const key = `xdcc:search:${id}:${limit}:${hintKey(hints)}:${query.toLowerCase()}`;
        const result = await this.cachedFetch<StoredPage>(
          key,
          async () => {
            const page = await indexer.search({ query, limit, hints });
            return { packs: page.packs.map(store), total: page.total };
          },
          SEARCH_TTL_MS,
          req.force,
        );
        if (result.items) packs.push(...result.items.packs.map(revive));
        sources.push({
          id,
          ok: !result.error,
          count: result.items?.packs.length ?? 0,
          total: result.items?.total ?? null,
          error: result.error ?? null,
          cachedAt: result.cachedAt ?? null,
        });
      }),
    );

    const matching = packs.filter((p) =>
      matchesQuery(p.filename, query, req.filter.match),
    );
    const grouped = groupReleases(matching, this.parse, req.preferredNetworks);
    const now = this.clock.now();
    const kept = sortReleases(
      grouped.filter((r) => passesFilter(r, req.filter, now)),
      query,
    );

    const posters = new Map<string, string | null>();
    if (req.artwork) {
      await Promise.all(
        kept.slice(0, ARTWORK_LIMIT).map(async (r) => {
          const poster = await this.artwork
            .poster(r.parsed, r.offers[0]?.filename ?? "")
            .catch(() => null);
          posters.set(r.key, poster);
        }),
      );
    }
    return {
      releases: kept,
      posters,
      sources,
      hidden: grouped.length - kept.length,
    };
  }
}
