import { IntegrationAuthError } from "@cockpit/integrations";
import { getCache, setCache } from "@cockpit/db";
import { getDb } from "./db";
import { getProviderConfig, type Provider } from "./credentials";
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
export async function throughCache<C>(
  provider: Provider,
  fetcher: (config: C) => Promise<unknown>,
  force: boolean,
): Promise<IntegrationPayload> {
  const config = await getProviderConfig<C>(provider as Provider);
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
