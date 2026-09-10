import {
  badRequest,
  json,
  notFound,
  readJson,
  type WidgetRoutes,
} from "../../server/contract";
import { MAX_RESULTS_PER_SOURCE } from "../config";
import {
  SOURCE_IDS,
  type SearchResponseDto,
  type SourceId,
  type WatchSettings,
} from "../types";
import { normalizeFilter } from "./domain/filter";
import { toReleaseDto } from "./domain/release";
import { NEWNESS_RULES, NOTIFY_MODES } from "./domain/watch";
import type { XdccServices } from "./composition";

const MAX_SNOOZE_HOURS = 24 * 30;

function sourcesFrom(value: unknown, fallback: SourceId[]): SourceId[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const picked = list
    .map((s) => String(s).trim().toLowerCase())
    .filter((s): s is SourceId =>
      (SOURCE_IDS as readonly string[]).includes(s),
    );
  return picked.length > 0 ? picked : fallback;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value))
    return value
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean);
  if (typeof value === "string")
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

/** Everything the client may send for a watch, validated into settings. */
function settingsFrom(body: Record<string, unknown>): WatchSettings | string {
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) return "query is required";
  const intervalHours = Number(body.intervalHours ?? 12);
  if (
    !Number.isFinite(intervalHours) ||
    intervalHours < 1 ||
    intervalHours > 24 * 7
  ) {
    return "intervalHours must be between 1 and 168";
  }
  const newness = NEWNESS_RULES.includes(body.newness as never)
    ? (body.newness as WatchSettings["newness"])
    : "indexed-after";
  const notifyMode = NOTIFY_MODES.includes(body.notifyMode as never)
    ? (body.notifyMode as WatchSettings["notifyMode"])
    : "default";
  const seriesFrom =
    body.seriesFrom && typeof body.seriesFrom === "object"
      ? (body.seriesFrom as { season?: unknown; episode?: unknown })
      : null;
  const autoPauseDays = Number(body.autoPauseDays);

  return {
    label: (typeof body.label === "string" && body.label.trim()) || query,
    query,
    filter: normalizeFilter(body.filter),
    sources: sourcesFrom(body.sources, [...SOURCE_IDS]),
    preferredNetworks: stringList(body.preferredNetworks).map((n) =>
      n.toLowerCase(),
    ),
    intervalHours: Math.round(intervalHours),
    seriesMode: body.seriesMode === true,
    seriesFrom:
      seriesFrom &&
      Number.isFinite(Number(seriesFrom.season)) &&
      Number.isFinite(Number(seriesFrom.episode))
        ? {
            season: Number(seriesFrom.season),
            episode: Number(seriesFrom.episode),
          }
        : null,
    newness,
    notifyMode,
    digest: body.digest !== false,
    commandInBody: body.commandInBody !== false,
    oneShot: body.oneShot === true,
    autoPauseDays:
      Number.isFinite(autoPauseDays) && autoPauseDays > 0
        ? Math.round(autoPauseDays)
        : null,
  };
}

/**
 * Mounted by the app under `/api/w/xdcc-watch/…`. Same-origin and the access
 * token are already enforced by the middleware.
 */
export function buildRoutes(services: XdccServices): WidgetRoutes {
  return {
    "GET search": async (_req, ctx) => {
      const params = ctx.url.searchParams;
      const query = params.get("q")?.trim() ?? "";
      if (!query) return badRequest("q is required");
      const limitParam = Number(params.get("limit") ?? MAX_RESULTS_PER_SOURCE);
      const limit = Number.isFinite(limitParam)
        ? Math.min(Math.max(1, Math.floor(limitParam)), MAX_RESULTS_PER_SOURCE)
        : MAX_RESULTS_PER_SOURCE;
      let filter;
      try {
        filter = normalizeFilter(JSON.parse(params.get("filter") ?? "{}"));
      } catch {
        return badRequest("filter must be JSON");
      }
      const result = await services.search.search({
        query,
        filter,
        sources: sourcesFrom(params.get("sources"), [...SOURCE_IDS]),
        preferredNetworks: stringList(params.get("networks")).map((n) =>
          n.toLowerCase(),
        ),
        limit,
        force: params.get("refresh") === "1",
        artwork: params.get("artwork") !== "0",
      });
      const payload: SearchResponseDto = {
        releases: result.releases.map((r) =>
          toReleaseDto(r, result.posters.get(r.key) ?? null),
        ),
        sources: result.sources,
        hidden: result.hidden,
      };
      return json(payload, { headers: { "cache-control": "no-store" } });
    },

    "GET watches": async (_req, ctx) => {
      const profileId = ctx.url.searchParams.get("profileId");
      if (!profileId) return badRequest("profileId is required");
      return json({ watches: services.watches.list(profileId) });
    },

    "POST watches": async (req) => {
      const body = await readJson<Record<string, unknown>>(req);
      if (!body || typeof body.profileId !== "string")
        return badRequest("profileId is required");
      const settings = settingsFrom(body);
      if (typeof settings === "string") return badRequest(settings);
      const watch = await services.watches.create(body.profileId, settings);
      return json({ watch }, { status: 201 });
    },

    "PATCH watches": async (req, ctx) => {
      const [id] = ctx.path;
      if (!id) return badRequest("watch id is required");
      const body = (await readJson<Record<string, unknown>>(req)) ?? {};
      if (typeof body.snoozeHours === "number") {
        const hours = Math.min(Math.max(1, body.snoozeHours), MAX_SNOOZE_HOURS);
        const snoozed = services.watches.snooze(id, hours);
        return snoozed ? json({ watch: snoozed }) : notFound("no such watch");
      }
      const patch: Record<string, unknown> = {};
      if (body.query !== undefined || body.filter !== undefined) {
        const settings = settingsFrom({
          ...body,
          query: body.query ?? services.watches.get(id)?.query,
        });
        if (typeof settings === "string") return badRequest(settings);
        Object.assign(patch, settings);
      } else {
        if (typeof body.label === "string") patch.label = body.label.trim();
        if (typeof body.intervalHours === "number")
          patch.intervalHours = Math.round(body.intervalHours);
        if (NOTIFY_MODES.includes(body.notifyMode as never))
          patch.notifyMode = body.notifyMode;
        if (typeof body.digest === "boolean") patch.digest = body.digest;
      }
      if (typeof body.active === "boolean") patch.active = body.active;
      const watch = services.watches.update(id, patch);
      return watch ? json({ watch }) : notFound("no such watch");
    },

    "DELETE watches": async (_req, ctx) => {
      const [id] = ctx.path;
      if (!id) return badRequest("watch id is required");
      services.watches.remove(id);
      return json({ ok: true });
    },

    "POST run": async (_req, ctx) => {
      const [id] = ctx.path;
      if (!id) return badRequest("watch id is required");
      if (!services.watches.get(id)) return notFound("no such watch");
      const outcome = await services.watches.run(id);
      return json({ ...outcome, watch: services.watches.get(id) });
    },

    "GET releases": async (_req, ctx) => {
      const profileId = ctx.url.searchParams.get("profileId");
      if (!profileId) return badRequest("profileId is required");
      const watchId = ctx.url.searchParams.get("watchId") ?? undefined;
      return json({ releases: services.watches.unseen(profileId, watchId) });
    },

    "POST releases": async (req, ctx) => {
      const [action] = ctx.path;
      if (action !== "seen") return notFound("no such route");
      const body = await readJson<{ profileId?: unknown; watchId?: unknown }>(
        req,
      );
      if (!body || typeof body.profileId !== "string")
        return badRequest("profileId is required");
      services.watches.markSeen(
        body.profileId,
        typeof body.watchId === "string" ? body.watchId : undefined,
      );
      return json({ ok: true });
    },
  };
}
