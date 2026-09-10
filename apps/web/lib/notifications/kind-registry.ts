import { KIND_LABELS } from "./domain/routing";

/**
 * Notification kinds widgets raise, registered when their server modules are
 * built (`widget-server.ts`). Kept outside the composition to avoid a cycle —
 * the widget glue imports `notify()`, not the other way round — and on
 * `globalThis` because Next gives each route bundle its own module instance.
 */
const globalForKinds = globalThis as unknown as {
  cockpitWidgetKinds?: Record<string, string>;
};
const registered = (globalForKinds.cockpitWidgetKinds ??= {});

export function registerKinds(kinds: Record<string, string>): void {
  Object.assign(registered, kinds);
}

export function allKindLabels(): Record<string, string> {
  return { ...KIND_LABELS, ...registered };
}
