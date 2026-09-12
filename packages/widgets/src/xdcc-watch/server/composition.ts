import { listInstances } from "@cockpit/db";
import type { WidgetServerDeps } from "../../server/contract";
import { defaultsFromConfig } from "../config";
import type { DefaultsDto } from "../types";
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
  /** The desk's widget settings turned into search defaults; the schema defaults when the desk has no tile. */
  defaults: (profileId: string) => DefaultsDto;
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
  const defaults = (profileId: string) =>
    defaultsFromConfig(
      listInstances(deps.db, profileId).find((i) => i.widgetId === "xdcc-watch")
        ?.config ?? {},
    );
  return { search, watches, defaults };
}
