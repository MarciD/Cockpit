import { assertPublicHttpUrl, BlockedUrlError } from "@cockpit/integrations";
import {
  badRequest,
  json,
  notFound,
  readJson,
  type CachedResult,
  type WidgetRoutes,
} from "../../server/contract";
import type {
  CalendarEvent,
  CalendarMeta,
  CalendarView,
} from "./infrastructure/google-calendar";
import {
  fetchIcsText,
  parseCalendarEvents,
  windowFor,
} from "./infrastructure/google-calendar";

const TEN_MIN_MS = 10 * 60_000;
const VIEWS: readonly CalendarView[] = ["day", "week", "month"];

export interface CalendarPayload {
  configured: boolean;
  calendars?: CalendarMeta[];
  items?: CalendarEvent[];
  error?: string;
}

type CachedFetch = <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs?: number,
  force?: boolean,
) => Promise<CachedResult<T>>;

/**
 * The calendar list lives in the credential store (URLs are the secret), so
 * the app hands this widget the same helpers its own settings UI uses.
 */
export interface CalendarStore {
  list: () => Promise<CalendarMeta[]>;
  sources: () => Promise<
    { id: string; label: string; url: string; color: string; source: string }[]
  >;
  add: (value: {
    label: string;
    url: string;
    source: string;
    color?: string;
  }) => Promise<CalendarMeta>;
  update: (
    id: string,
    patch: Record<string, unknown>,
  ) => Promise<CalendarMeta | null>;
  remove: (id: string) => Promise<void>;
}

export async function readEvents(
  store: CalendarStore,
  cachedFetch: CachedFetch,
  view: CalendarView,
  timeZone: string,
  force = false,
): Promise<CalendarPayload> {
  const sources = await store.sources();
  if (sources.length === 0) return { configured: false };

  const { fromISO, toISO } = windowFor(view, timeZone);
  const results = await Promise.allSettled(
    sources.map(async (calendar) => {
      const cached = await cachedFetch<string>(
        `calendar:${calendar.url}`,
        () => fetchIcsText(calendar.url),
        TEN_MIN_MS,
        force,
      );
      if (typeof cached.items !== "string") {
        throw new Error(cached.error ?? "no calendar data");
      }
      return parseCalendarEvents(cached.items, calendar.id, fromISO, toISO);
    }),
  );

  const items = results
    .filter(
      (r): r is PromiseFulfilledResult<CalendarEvent[]> =>
        r.status === "fulfilled",
    )
    .flatMap((r) => r.value)
    .sort((a, b) => a.start.localeCompare(b.start));
  const failure = results.find(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );

  return {
    configured: true,
    calendars: await store.list(),
    items,
    // Only surface an error when nothing survived; one flaky feed stays quiet.
    ...(items.length === 0 && failure
      ? { error: (failure.reason as Error).message }
      : {}),
  };
}

export function buildRoutes(
  store: CalendarStore,
  cachedFetch: CachedFetch,
): WidgetRoutes {
  return {
    "GET ": async (_req, ctx) => {
      const sp = ctx.url.searchParams;
      const requested = sp.get("view") ?? "day";
      const view = (VIEWS as readonly string[]).includes(requested)
        ? (requested as CalendarView)
        : "day";
      const payload = await readEvents(
        store,
        cachedFetch,
        view,
        sp.get("tz") ?? "UTC",
        sp.get("refresh") === "1",
      );
      return json(payload);
    },

    "GET calendars": async () => json({ calendars: await store.list() }),

    "POST calendars": async (req) => {
      const body = await readJson<Record<string, unknown>>(req);
      const label = typeof body?.label === "string" ? body.label.trim() : "";
      const url = typeof body?.url === "string" ? body.url.trim() : "";
      const source = typeof body?.source === "string" ? body.source : "ical";
      if (!label || !url) return badRequest("label and url are required");
      try {
        assertPublicHttpUrl(url, "The calendar URL");
      } catch (err) {
        if (err instanceof BlockedUrlError) return badRequest(err.message);
        throw err;
      }
      const color = typeof body?.color === "string" ? body.color : undefined;
      return json(await store.add({ label, url, source, color }));
    },

    "PATCH calendars": async (req, ctx) => {
      const [id] = ctx.path;
      if (!id) return badRequest("calendar id is required");
      const body = (await readJson<Record<string, unknown>>(req)) ?? {};
      if (typeof body.url === "string") {
        try {
          assertPublicHttpUrl(body.url, "The calendar URL");
        } catch (err) {
          if (err instanceof BlockedUrlError) return badRequest(err.message);
          throw err;
        }
      }
      const updated = await store.update(id, body);
      return updated ? json(updated) : notFound("no such calendar");
    },

    "DELETE calendars": async (_req, ctx) => {
      const [id] = ctx.path;
      if (!id) return badRequest("calendar id is required");
      await store.remove(id);
      return json({ ok: true });
    },
  };
}
