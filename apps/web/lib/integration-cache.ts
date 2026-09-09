import {
  fetchIcsText,
  getNews,
  getWeather,
  IntegrationAuthError,
  listMergeRequests,
  listMyIssues,
  parseCalendarEvents,
  windowFor,
  type CalendarEvent,
  type CalendarMeta,
  type CalendarView,
  type GitLabConfig,
  type JiraConfig,
} from "@cockpit/integrations";
import { getCache, setCache } from "@cockpit/db";
import { getDb } from "./db";
import { getProviderConfig, listCalendars, type Provider } from "./credentials";
import { notify } from "./notifications/composition";

const TTL_MS = 5 * 60_000;
const AUTH_FAILED_DEDUPE_MS = 24 * 60 * 60_000;

const PROVIDER_LABELS: Partial<Record<Provider, string>> = {
  gitlab: "GitLab",
  jira: "Jira",
  google: "Google",
  calendar: "Calendars",
  anthropic: "Claude",
};

export interface IntegrationPayload {
  configured: boolean;
  items?: unknown;
  error?: string;
  /** The provider rejected the stored credential — the user must reconnect. */
  authFailed?: boolean;
  cachedAt?: string;
}

/**
 * Stale-while-revalidate: serve fresh cache when available, otherwise fetch
 * live and cache it. On a live error, fall back to the last good cached value
 * (with the error attached) so a blip doesn't blank the widget. The scheduler
 * calls these with force=true to keep the cache warm in the background.
 */
async function throughCache<C>(
  provider: Provider,
  fetcher: (config: C) => Promise<unknown>,
  force: boolean,
): Promise<IntegrationPayload> {
  const config = await getProviderConfig<C>(provider);
  if (!config) return { configured: false };

  const db = getDb();
  const key = `integration:${provider}`;
  const cached = getCache(db, key);
  const isFresh =
    cached !== undefined && Date.now() - cached.fetchedAt.getTime() < TTL_MS;

  if (!force && isFresh && cached) {
    return {
      configured: true,
      items: cached.payloadJson,
      cachedAt: cached.fetchedAt.toISOString(),
    };
  }

  try {
    const items = await fetcher(config);
    setCache(db, key, items);
    return { configured: true, items, cachedAt: new Date().toISOString() };
  } catch (err) {
    // A rejected credential is flagged so the widget can offer a reconnect
    // instead of an error the user has no way to act on — and raised once a
    // day in the inbox, so it is noticed before the desk is opened.
    const auth =
      err instanceof IntegrationAuthError ? { authFailed: true } : {};
    if (err instanceof IntegrationAuthError) {
      void notify({
        kind: "integration.auth-failed",
        severity: "action",
        title: `${PROVIDER_LABELS[provider] ?? provider} rejected the saved credential`,
        body: `${err.message} Reconnect it in the widget's settings.`,
        url: "/",
        dedupeKey: `integration.auth-failed:${provider}`,
        dedupeWindowMs: AUTH_FAILED_DEDUPE_MS,
        data: { source: provider },
      });
    }
    if (cached) {
      return {
        configured: true,
        items: cached.payloadJson,
        error: (err as Error).message,
        ...auth,
        cachedAt: cached.fetchedAt.toISOString(),
      };
    }
    return { configured: true, error: (err as Error).message, ...auth };
  }
}

export const getGitlabData = (force = false) =>
  throughCache<GitLabConfig>("gitlab", (c) => listMergeRequests(c), force);

export const getJiraData = (force = false) =>
  throughCache<JiraConfig>("jira", (c) => listMyIssues(c), force);

/**
 * Keyless stale-while-revalidate over the same cache table — for sources that
 * need no credential (weather, news). Same fresh/stale/error-fallback logic as
 * throughCache, but the caller supplies the cache key, fetcher and TTL.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = TTL_MS,
  force = false,
): Promise<IntegrationPayload> {
  const db = getDb();
  const cached = getCache(db, key);
  const isFresh =
    cached !== undefined && Date.now() - cached.fetchedAt.getTime() < ttlMs;

  if (!force && isFresh && cached) {
    return {
      configured: true,
      items: cached.payloadJson,
      cachedAt: cached.fetchedAt.toISOString(),
    };
  }

  try {
    const items = await fetcher();
    setCache(db, key, items);
    return { configured: true, items, cachedAt: new Date().toISOString() };
  } catch (err) {
    if (cached) {
      return {
        configured: true,
        items: cached.payloadJson,
        error: (err as Error).message,
        cachedAt: cached.fetchedAt.toISOString(),
      };
    }
    return { configured: true, error: (err as Error).message };
  }
}

const HALF_HOUR_MS = 30 * 60_000;
const TEN_MIN_MS = 10 * 60_000;

export const getWeatherData = (
  lat: number,
  lon: number,
  label: string,
  force = false,
) =>
  cachedFetch(
    `weather:${lat},${lon}`,
    () => getWeather({ latitude: lat, longitude: lon, label }),
    HALF_HOUR_MS,
    force,
  );

export const getNewsData = (feeds: string[], limit: number, force = false) =>
  cachedFetch(
    `news:${[...feeds].sort().join("|")}:${limit}`,
    () => getNews({ feeds, limit }),
    TEN_MIN_MS,
    force,
  );

export interface CalendarPayload {
  configured: boolean;
  calendars?: CalendarMeta[];
  items?: CalendarEvent[];
  error?: string;
  cachedAt?: string;
}

/** Merge events for the view's window across all connected calendars. */
export async function getCalendarEvents(
  view: CalendarView,
  tz: string,
  force = false,
): Promise<CalendarPayload> {
  const calendars = await listCalendars();
  if (calendars.length === 0) return { configured: false };

  const { fromISO, toISO } = windowFor(view, tz);
  const meta: CalendarMeta[] = calendars.map((c) => ({
    id: c.id,
    label: c.label,
    color: c.color,
    source: c.source,
  }));

  const results = await Promise.allSettled(
    calendars.map(async (c) => {
      const cached = await cachedFetch<string>(
        `calendar:${c.url}`,
        () => fetchIcsText(c.url),
        TEN_MIN_MS,
        force,
      );
      if (typeof cached.items !== "string") {
        throw new Error(cached.error ?? "no calendar data");
      }
      return parseCalendarEvents(cached.items, c.id, fromISO, toISO);
    }),
  );

  const items: CalendarEvent[] = [];
  let error: string | undefined;
  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value);
    else
      error = (r.reason as Error)?.message ?? "Some calendars failed to load";
  }
  items.sort((a, b) => a.start.localeCompare(b.start));
  return {
    configured: true,
    calendars: meta,
    items,
    error: items.length === 0 ? error : undefined,
    cachedAt: new Date().toISOString(),
  };
}

/** For the assistant's get_today_events tool (uses the server's tz). */
export const getCalendarData = () =>
  getCalendarEvents("day", Intl.DateTimeFormat().resolvedOptions().timeZone);
