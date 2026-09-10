import type { WidgetServerDeps } from "../../server/contract";
import { SearchService } from "./application/search-service";
import { WatchService } from "./application/watch-service";
import { CachedArtwork, type TmdbConfig } from "./infrastructure/artwork";
import { DrizzleSeenRepository } from "./infrastructure/drizzle-seen-repository";
import { DrizzleWatchRepository } from "./infrastructure/drizzle-watch-repository";
import { NiblIndexer } from "./infrastructure/indexer-nibl";
import { XdccInfoIndexer } from "./infrastructure/indexer-xdccinfo";
import { XdccSearchIndexer } from "./infrastructure/indexer-xdccsearch";
import { parseFilename } from "./infrastructure/parser";

export interface XdccServices {
  search: SearchService;
  watches: WatchService;
}

/** The only place adapters are wired to services. */
export function buildServices(deps: WidgetServerDeps): XdccServices {
  const clock = { now: () => new Date() };
  const search = new SearchService(
    [
      new XdccInfoIndexer(),
      new XdccSearchIndexer(),
      new NiblIndexer(deps.cachedFetch),
    ],
    parseFilename,
    deps.cachedFetch,
    new CachedArtwork(deps.cachedFetch, () =>
      deps.getProviderConfig<TmdbConfig>("tmdb"),
    ),
    clock,
  );
  const watches = new WatchService(
    new DrizzleWatchRepository(deps.db),
    new DrizzleSeenRepository(deps.db),
    search,
    deps.notify,
    clock,
    () => crypto.randomUUID(),
    deps.log,
  );
  return { search, watches };
}
