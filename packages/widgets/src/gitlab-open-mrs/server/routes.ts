import type { GitLabConfig } from "./infrastructure/gitlab";
import { listMergeRequests } from "./infrastructure/gitlab";
import {
  json,
  type IntegrationResult,
  type WidgetRoutes,
} from "../../server/contract";
import { PROVIDER } from "../config";

type ThroughCache = <C, T>(
  provider: string,
  fetcher: (config: C) => Promise<T>,
  force?: boolean,
) => Promise<IntegrationResult<T>>;

export function readMergeRequests(throughCache: ThroughCache, force = false) {
  return throughCache<
    GitLabConfig,
    Awaited<ReturnType<typeof listMergeRequests>>
  >(PROVIDER, (config) => listMergeRequests(config), force);
}

export function buildRoutes(throughCache: ThroughCache): WidgetRoutes {
  return {
    "GET ": async (_req, ctx) =>
      json(
        await readMergeRequests(
          throughCache,
          ctx.url.searchParams.get("refresh") === "1",
        ),
      ),
  };
}
