import { serverWidgetFactoriesWith } from "@cockpit/widgets/server";
import type {
  WidgetServerDeps,
  WidgetServerModule,
} from "@cockpit/widgets/server/contract";
import {
  addCalendar,
  deleteCalendar,
  deleteProviderConfig,
  getProviderConfig,
  listCalendars,
  setProviderConfig,
  updateCalendar,
  type Provider,
} from "./credentials";
import { getDb } from "./db";
import { cachedFetch, throughCache } from "./integration-cache";
import { notificationServices } from "./notifications/composition";
import { registerKinds } from "./notifications/kind-registry";
import { userName } from "./user";
import { reloadWidgetJobs } from "./widget-jobs";
import { notify, scheduleNotification } from "./notifications/composition";

const globalForModules = globalThis as unknown as {
  cockpitWidgetServers?: Record<string, WidgetServerModule>;
};

/**
 * Every widget's server module, built once per process with the app's
 * dependencies injected. The catch-all API route, the generic page route and
 * the scheduler all read this map; a widget itself never imports app code.
 */
export function widgetServerModules(): Record<string, WidgetServerModule> {
  const cached = globalForModules.cockpitWidgetServers;
  if (cached) {
    // Kinds are registered per call, not per build: Next gives each route
    // bundle its own module instances, so a later bundle would otherwise see
    // the cached modules but an empty kind registry.
    registerAllKinds(cached);
    return cached;
  }
  const baseDeps: Omit<WidgetServerDeps, "reloadJobs" | "assistantTools"> = {
    db: getDb(),
    notify,
    scheduleNotification,
    getProviderConfig: (provider) => getProviderConfig(provider as Provider),
    setProviderConfig: (provider, config) =>
      setProviderConfig(provider as Provider, config),
    deleteProviderConfig: (provider) =>
      deleteProviderConfig(provider as Provider),
    // `cachedFetch` returns the widened IntegrationPayload (`items?: unknown`);
    // the widget contract promises the fetcher's own type back.
    cachedFetch: async (key, fetcher, ttlMs, force) => {
      const payload = await cachedFetch(key, fetcher, ttlMs, force);
      return {
        items: payload.items as Awaited<ReturnType<typeof fetcher>> | undefined,
        error: payload.error,
        cachedAt: payload.cachedAt,
      };
    },
    throughCache: async (provider, fetcher, force) => {
      const payload = await throughCache(
        provider as Provider,
        fetcher,
        force ?? false,
      );
      return {
        configured: payload.configured,
        items: payload.items as Awaited<ReturnType<typeof fetcher>> | undefined,
        error: payload.error,
        authFailed: payload.authFailed,
        cachedAt: payload.cachedAt,
      };
    },
    log: {
      warn: (message) => process.stderr.write(`[cockpit] ${message}\n`),
    },
    ownerName: userName() ? `${userName()}'s` : "the user's",
    unreadNotifications: async () =>
      JSON.stringify(
        notificationServices()
          .inbox.list({ unreadOnly: true, limit: 20 })
          .map((n) => ({
            kind: n.kind,
            severity: n.severity,
            title: n.title,
            body: n.body,
            createdAt: n.createdAt.toISOString(),
          })),
      ),
  };
  // The calendar widget's feed URLs are credentials, so the store is injected
  // rather than reached into from the widget.
  const calendarStore = {
    list: async () =>
      (await listCalendars()).map(({ id, label, color, source }) => ({
        id,
        label,
        color,
        source,
      })),
    sources: () => listCalendars(),
    add: (value: {
      label: string;
      url: string;
      source: string;
      color?: string;
    }) =>
      addCalendar({
        label: value.label,
        url: value.url,
        source: value.source as Parameters<typeof addCalendar>[0]["source"],
        color: value.color,
      }),
    update: async (id: string, patch: Record<string, unknown>) => {
      const ok = await updateCalendar(
        id,
        patch as Parameters<typeof updateCalendar>[1],
      );
      if (!ok) return null;
      const found = (await listCalendars()).find((c) => c.id === id);
      return found
        ? {
            id: found.id,
            label: found.label,
            color: found.color,
            source: found.source,
          }
        : null;
    },
    remove: (id: string) => deleteCalendar(id),
  };

  const modules: Record<string, WidgetServerModule> = {};
  for (const [id, factory] of Object.entries(
    serverWidgetFactoriesWith(calendarStore),
  )) {
    modules[id] = factory({
      ...baseDeps,
      reloadJobs: () => reloadWidgetJobs(id),
      // Every *other* widget's tools, read lazily so the map is complete by
      // the time the assistant asks for them.
      assistantTools: () =>
        Object.entries(globalForModules.cockpitWidgetServers ?? modules)
          .filter(([otherId]) => otherId !== id)
          .map(([, mod]) => mod.assistantTools ?? []),
    });
  }
  registerAllKinds(modules);
  globalForModules.cockpitWidgetServers = modules;
  return modules;
}

function registerAllKinds(modules: Record<string, WidgetServerModule>): void {
  for (const mod of Object.values(modules)) {
    if (mod.kinds) registerKinds(mod.kinds);
  }
}
