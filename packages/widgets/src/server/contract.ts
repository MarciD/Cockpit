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

export interface WidgetJobContext {
  /** When this job fires next, from the scheduler's own cron handle. */
  nextRunAt: Date | null;
}

export interface WidgetJob {
  name: string;
  cron: string;
  run: (ctx: WidgetJobContext) => Promise<void> | void;
  /** Called when the job is (re)registered, so a widget can store its next run. */
  onSchedule?: (ctx: WidgetJobContext) => void;
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

/** What a credential-backed fetch returns; mirrors the integration cache. */
export interface IntegrationResult<T> extends CachedResult<T> {
  configured: boolean;
  /** The provider rejected the credential — the widget should offer a reconnect. */
  authFailed?: boolean;
}

/** A read-only tool this widget contributes to the assistant. */
export interface WidgetAssistantTool {
  name: string;
  description: string;
  /** Raw JSON Schema (`as const`); Zod v4-typed helpers are avoided on purpose. */
  inputSchema: Record<string, unknown>;
  run: (
    input: Record<string, unknown>,
    ctx: { profileId: string },
  ) => Promise<string>;
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
  /**
   * The same cache, but for a provider that needs a credential: loads it,
   * serves fresh or stale, and flags `authFailed` when the provider rejected
   * it so the widget can render a reconnect prompt instead of a dead string.
   */
  throughCache: <C, T>(
    provider: string,
    fetcher: (config: C) => Promise<T>,
    force?: boolean,
  ) => Promise<IntegrationResult<T>>;
  log: { warn: (message: string) => void };
  /** Ask the scheduler to re-read this widget's jobs (after a row changed). */
  reloadJobs: () => void;
  /** Display name for prompts, from COCKPIT_USER_NAME; "the user's" when unset. */
  ownerName: string;
  /** Every *other* widget's assistant tools, so one widget can host the chat. */
  assistantTools: () => WidgetAssistantTool[][];
  /** The unread inbox as JSON, for the assistant's own tool. */
  unreadNotifications: () => Promise<string>;
}

export interface WidgetServerModule {
  id: string;
  routes: WidgetRoutes;
  /**
   * A function when the set of jobs depends on data (one cron per stored row);
   * the widget then calls `deps.reloadJobs()` after a change.
   */
  jobs?: WidgetJob[] | (() => WidgetJob[]);
  /** Notification kinds this widget raises, with the label the settings matrix shows. */
  kinds?: Record<string, string>;
  /** Read-only tools the assistant may call. `profileId` is bound by the app. */
  assistantTools?: WidgetAssistantTool[];
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

/** Tool payloads the assistant reads: never a raw dump, never an exception. */
export function describePayload(
  label: string,
  payload: { configured: boolean; items?: unknown; error?: string },
): string {
  if (!payload.configured) return `${label} is not connected.`;
  if (payload.error) return `${label} error: ${payload.error}`;
  return JSON.stringify(payload.items ?? []);
}

export function resolveJobs(mod: WidgetServerModule): WidgetJob[] {
  return typeof mod.jobs === "function" ? mod.jobs() : (mod.jobs ?? []);
}

export const EMPTY_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;
