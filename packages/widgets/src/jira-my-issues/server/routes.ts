import {
  json,
  type IntegrationResult,
  type WidgetRoutes,
} from "../../server/contract";
import { PROVIDER } from "../config";
import { listMyIssues, type JiraConfig } from "./infrastructure/jira";

type ThroughCache = <C, T>(
  provider: string,
  fetcher: (config: C) => Promise<T>,
  force?: boolean,
) => Promise<IntegrationResult<T>>;

export function readIssues(throughCache: ThroughCache, force = false) {
  return throughCache<JiraConfig, Awaited<ReturnType<typeof listMyIssues>>>(
    PROVIDER,
    (config) => listMyIssues(config),
    force,
  );
}

export function buildRoutes(throughCache: ThroughCache): WidgetRoutes {
  return {
    "GET ": async (_req, ctx) =>
      json(
        await readIssues(
          throughCache,
          ctx.url.searchParams.get("refresh") === "1",
        ),
      ),
  };
}
