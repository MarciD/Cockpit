/**
 * Structural guard for a client-supplied widget config.
 *
 * The per-widget Zod schema can't be used here: most widget modules are
 * `"use client"`, so importing the registry from a route handler yields client
 * references rather than the real `configSchema`. (Moving every schema into a
 * framework-free `config.ts` sibling, exported on its own package subpath,
 * would fix that — see docs/widgets.md.) Until then this checks shape and size
 * only, and the fields that actually reach a server-side fetch are validated
 * where they are consumed: feed URLs in /api/news, coordinates in /api/weather.
 */

const MAX_BYTES = 8 * 1024;
const MAX_DEPTH = 4;

function depthOf(value: unknown, depth = 1): number {
  if (value === null || typeof value !== "object") return depth;
  if (depth > MAX_DEPTH) return depth;
  const children = Object.values(value as Record<string, unknown>);
  return children.reduce<number>(
    (max, child) => Math.max(max, depthOf(child, depth + 1)),
    depth,
  );
}

/** The reason this config is unacceptable, or null when it is fine. */
export function widgetConfigError(value: unknown): string | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "config must be a JSON object";
  }
  if (JSON.stringify(value).length > MAX_BYTES) {
    return `config must be under ${MAX_BYTES} bytes`;
  }
  if (depthOf(value) > MAX_DEPTH) {
    return `config must not nest deeper than ${MAX_DEPTH} levels`;
  }
  return null;
}
