import type { CockpitDb } from "@cockpit/db";

/**
 * What a widget's server half exports, and what the app hands it. The app
 * mounts every module's routes under `/api/w/<widget>/…`, registers its jobs
 * with the scheduler and builds it once with these dependencies, so a widget
 * never imports app internals.
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface WidgetRouteContext {
  /** Path segments after the first one, e.g. `["<id>"]` for `PATCH watches/<id>`. */
  path: string[];
  url: URL;
}

export type WidgetRouteHandler = (
  req: Request,
  ctx: WidgetRouteContext,
) => Promise<Response> | Response;

/** Keyed `"<METHOD> <first segment>"`; `"GET "` (empty segment) is the module root. */
export type WidgetRoutes = Partial<
  Record<`${HttpMethod} ${string}`, WidgetRouteHandler>
>;

export interface WidgetJob {
  name: string;
  cron: string;
  run: () => Promise<void> | void;
}

/** Mirrors the notification core's input; kept here so widgets stay app-free. */
export interface NotifyInput {
  kind: string;
  title: string;
  body?: string;
  url?: string;
  severity?: "info" | "action" | "urgent";
  profileId?: string | null;
  data?: Record<string, unknown>;
  dedupeKey?: string;
  dedupeWindowMs?: number;
  /** Explicit channel list; overrides the per-kind preferences (quiet hours still apply). */
  channels?: ("desktop" | "phone")[];
}

export interface CachedResult<T> {
  items?: T;
  error?: string;
  cachedAt?: string;
}

export interface WidgetServerDeps {
  db: CockpitDb;
  notify: (input: NotifyInput) => Promise<unknown>;
  scheduleNotification: (fireAt: Date, input: NotifyInput) => unknown;
  getProviderConfig: <T>(provider: string) => Promise<T | null>;
  setProviderConfig: (provider: string, config: unknown) => Promise<void>;
  deleteProviderConfig: (provider: string) => Promise<void>;
  /** Server-side stale-while-revalidate cache keyed by string (the `cache` table). */
  cachedFetch: <T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs?: number,
    force?: boolean,
  ) => Promise<CachedResult<T>>;
  log: { warn: (message: string) => void };
}

export interface WidgetServerModule {
  id: string;
  routes: WidgetRoutes;
  jobs?: WidgetJob[];
  /** Notification kinds this widget raises, with the label the settings matrix shows. */
  kinds?: Record<string, string>;
}

export type WidgetServerFactory = (
  deps: WidgetServerDeps,
) => WidgetServerModule;

/** Small helpers every widget's routes end up needing. */
export function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

export function badRequest(message: string): Response {
  return json({ error: message }, { status: 400 });
}

export function notFound(message = "not found"): Response {
  return json({ error: message }, { status: 404 });
}

export async function readJson<T>(req: Request): Promise<T | null> {
  return (await req.json().catch(() => null)) as T | null;
}
