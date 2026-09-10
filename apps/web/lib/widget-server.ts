import { serverWidgetFactories } from "@cockpit/widgets/server";
import type {
  WidgetServerDeps,
  WidgetServerModule,
} from "@cockpit/widgets/server/contract";
import {
  deleteProviderConfig,
  getProviderConfig,
  setProviderConfig,
  type Provider,
} from "./credentials";
import { getDb } from "./db";
import { cachedFetch } from "./integration-cache";
import { registerKinds } from "./notifications/kind-registry";
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
  const deps: WidgetServerDeps = {
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
    log: {
      warn: (message) => process.stderr.write(`[cockpit] ${message}\n`),
    },
  };
  const modules: Record<string, WidgetServerModule> = {};
  for (const [id, factory] of Object.entries(serverWidgetFactories)) {
    modules[id] = factory(deps);
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
