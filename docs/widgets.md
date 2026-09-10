# Building a widget

A widget is one folder under `packages/widgets/src/` and one line in
`registry.ts`. Nothing else is wired by hand — the host discovers it, renders it
in the grid, generates its settings form, fetches its data, and publishes its
summary to the assistant.

Two rules are not negotiable:

1. **Widgets fetch only through `/api/*`.** They never import the database, the
   integration cache, or the credential store. Those are Node-only and hold
   secrets; widgets are client components.
2. **`config` is client-visible.** It is merged in the browser and handed to your
   component, so a secret in `config` is a secret in the page source. Secrets go
   through a `connection` (below) into the server-side credential store.

---

## The contract

`defineWidget()` takes one object. From
[`packages/widget-sdk/src/index.ts`](../packages/widget-sdk/src/index.ts):

| Field               | Type                                      |          | What the host does with it                                                                                                                |
| ------------------- | ----------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                | `string`                                  | required | Registry key, and the `widgetId` stored on every instance. Changing it orphans existing instances.                                        |
| `title`             | `string`                                  | required | Card header, and the catalog row.                                                                                                         |
| `description`       | `string`                                  | optional | **Catalog only.** Never shown on the live tile.                                                                                           |
| `icon`              | `ComponentType`                           | required | **Catalog only** too — the card header uses a plain accent dot.                                                                           |
| `category`          | `WidgetCategory`                          | required | Groups the catalog: `source-control`, `issues`, `calendar`, `tasks`, `ai`, `custom`.                                                      |
| `configSchema`      | `ZodType<TConfig>`                        | required | Validates the settings form _and_ is introspected to generate its fields.                                                                 |
| `defaultConfig`     | `TConfig`                                 | required | Merged _under_ the stored config in the browser, so a field you add later appears on existing instances.                                  |
| `layout`            | `WidgetLayoutSpec`                        | required | `defaultW`/`defaultH` (grid units, 12 columns, 40px rows) plus optional `minW`/`minH`/`maxW`/`maxH`, `mobileH`, `mobileHidden`.           |
| `data`              | `WidgetDataSpec`                          | required | Drives one TanStack Query per instance.                                                                                                   |
| `Component`         | `ComponentType<WidgetComponentProps>`     | required | Rendered once the query succeeds. The host owns loading and error states.                                                                 |
| `count`             | `(data) => number \| string \| undefined` | optional | Small header badge. Returning `""` means _no badge_.                                                                                      |
| `describe`          | `(config, data) => …`                     | optional | One-line summary published to the assistant.                                                                                              |
| `connection`        | `WidgetConnection`                        | optional | Credential fields in this widget's settings. Also flips `manualRefresh` on by default.                                                    |
| `SettingsComponent` | `ComponentType<{ onClose }>`              | optional | Replaces the whole generated form. For settings that aren't flat fields — see `google-calendar-today`, which manages a list of calendars. |

`data` is:

```ts
interface WidgetDataSpec<TConfig, TData> {
  queryKey: (config: TConfig, profileId: string) => QueryKey;
  queryFn: (ctx: WidgetDataContext, config: TConfig) => Promise<TData>;
  refetchIntervalMs?: number;
  staleTimeMs?: number;
  manualRefresh?: boolean; // defaults to `!!connection`
}
```

and `ctx` is exactly `{ profileId, signal, force }` — nothing else. `signal` is
the query's `AbortSignal`; pass it to `fetch`. `force` is `true` only on the
fetch triggered by the user pressing the sync button, and resets immediately
after.

Your component receives `{ config, data, onOpenSettings }`. Additional props may
be added over time, so destructure what you need rather than positionally.

---

## Where a widget lives

**One folder per widget.** `packages/widgets/src/<widget>/` holds everything
the widget owns — client, server and tables. Outside that folder a widget is
one line in `registry.ts` (and, once it has server code, one line in the
server registry) plus generic glue that is never written per widget.

```
packages/widgets/src/<widget>/
  README.md        what it does, screenshots, settings, routes, tables, jobs,
                   notifications it raises — kept current with the code
  screenshots/     tile.png, page.png, settings.png (2×, PNG, ≤ 300 KB each)
  index.tsx        defineWidget() — the tile (client)
  config.ts        the zod configSchema + defaultConfig, framework-free
  types.ts         DTOs shared by tile, page and server (types only)
  ui/  page/       client components; a full page on its own package subpath
  server/          only when the widget has server logic
    index.ts       starts with `import "server-only"`
    schema.ts      Drizzle tables — imports drizzle-orm/sqlite-core only
    domain/ application/ infrastructure/ composition.ts
    routes.ts      request handlers, mounted by the generic /api/w/[widget] route
    jobs.ts        cron jobs, registered by the scheduler with `catch: onJobError`
```

Rules:

- A provider adapter that only this widget uses lives in
  `server/infrastructure/`. `packages/integrations` keeps shared pieces only:
  `net.ts`, `errors.ts`, the credential store.
- Cross-cutting services stay in `apps/web/lib`: notifications, images,
  credentials, the integration cache, the scheduler. Widgets call them from
  their server code.
- Client code never imports `server/`; `server-only` turns that into a build
  error. `registry.ts` must not import a widget's `server/` either.
- Widget tables are queried with the query builder
  (`db.select().from(table)`), not `db.query.*`, because `createDb` registers
  only the core schema for the relational API.
- Screenshots come from `ops/screenshots` (Playwright against an isolated dev
  server with scratch data, see its README), the widget alone on a desk, at 2×.
  Retake them when the widget's look changes.

**Status (2026-09-10):** every widget is in this shape. The glue lives in
`packages/widgets/src/server/{contract,registry}.ts`,
`packages/widgets/src/pages.ts`, `apps/web/lib/widget-server.ts`,
`apps/web/app/api/w/[widget]/[[...path]]/route.ts`,
`apps/web/app/w/[widget]/page.tsx`, the scheduler's `registerWidgetJobs`, and
the drizzle-kit schema glob. `apps/web` no longer holds a single
widget-specific route, adapter or job.

`kitchen-coach` is the second worked example after `language-learning`: same
layering, but with structured outputs, a streaming chat route, and pure domain
code for the things a model should never be asked (scaling, the seasonal
calendar, intent classification).

Three things the app still owns on a widget's behalf, because they are
cross-cutting: the credential store (a widget gets `getProviderConfig` and
friends through `deps`, and the calendar widget gets its list store injected),
the notification core, and the integration cache (`cachedFetch` for keyless
sources, `throughCache` for credentialed ones).

Four things the glue makes non-obvious:

- **`pages.ts` must not be a `"use client"` module.** A server component
  importing one receives client-reference proxies, so the page lookup comes
  back undefined and the route 404s. The page components carry their own
  `"use client"`.
- **A widget's notification kinds register when its server module is built**,
  and Next gives each route bundle its own module instances — so
  `widgetServerModules()` re-registers them on every call, and the kind
  registry lives on `globalThis`.
- **Workspace packages are stricter than the app.** The shared tsconfig turns
  on `noUncheckedIndexedAccess`, which `apps/web/tsconfig.json` does not, so
  code moving into a widget usually needs a few index accesses guarded.
- **A widget whose jobs depend on stored rows** declares `jobs` as a function
  and calls `deps.reloadJobs()` after a change; each job is handed its own
  `nextRunAt`, so the widget can store it without knowing about croner.

---

## Stage 1 — a widget with no server code

The smallest useful widget: config in, markup out. Modelled on
[`custom-api`](../packages/widgets/src/custom-api/index.tsx) and
[`weather`](../packages/widgets/src/weather/index.tsx).

`packages/widgets/src/world-clock/index.tsx`:

```tsx
"use client";

import { z } from "zod";
import { Stack, Text } from "@chakra-ui/react";
import { defineWidget, type WidgetComponentProps } from "@cockpit/widget-sdk";

// Defaults live in `defaultConfig`, not in the schema — that keeps the schema's
// input and output types identical, which `ZodType<TConfig>` requires.
const configSchema = z.object({
  timeZone: z.string(),
  label: z.string(),
  seconds: z.boolean(),
});
type Config = z.infer<typeof configSchema>;

interface Data {
  iso: string;
}

function Panel({ config, data }: WidgetComponentProps<Config, Data>) {
  const time = new Date(data.iso).toLocaleTimeString("en-GB", {
    timeZone: config.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    ...(config.seconds ? { second: "2-digit" } : {}),
  });
  return (
    <Stack gap="1">
      <Text textStyle="label">{config.label}</Text>
      <Text textStyle="data" fontSize="3xl">
        {time}
      </Text>
    </Stack>
  );
}

const worldClockWidget = defineWidget<Config, Data>({
  id: "world-clock",
  title: "Clock",
  description: "The time in another timezone.",
  icon: () => <span aria-hidden>◷</span>,
  category: "custom",
  configSchema,
  defaultConfig: { timeZone: "UTC", label: "UTC", seconds: false },
  layout: { defaultW: 3, defaultH: 4, minW: 2, minH: 3, mobileH: 3 },
  data: {
    queryKey: (config, profileId) => [
      "world-clock",
      profileId,
      config.timeZone,
    ],
    queryFn: async () => ({ iso: new Date().toISOString() }),
    refetchIntervalMs: 30_000,
  },
  Component: Panel,
  describe: (config) => `A clock showing ${config.label} time.`,
});

export default worldClockWidget;
```

Register it in [`registry.ts`](../packages/widgets/src/registry.ts) — an import
and an array entry:

```ts
import worldClock from "./world-clock";

const definitions: WidgetDefinition[] = [
  // …
  worldClock as unknown as WidgetDefinition,
];
```

The cast is only there to erase the generic parameters so one array can hold
every widget; your own `defineWidget<Config, Data>({…})` call is still fully
type-checked.

That is the whole loop: the widget now appears in the catalog, can be placed,
dragged, resized, and configured.

### What the generated settings form supports

[`widget-config-form.tsx`](../apps/web/components/widget-config-form.tsx) walks
`configSchema.shape` and renders one control per field:

| Zod type          | Control          |
| ----------------- | ---------------- |
| `z.boolean()`     | checkbox         |
| `z.number()`      | number input     |
| `z.enum([...])`   | select           |
| **anything else** | plain text input |

`.optional()`, `.default()` and `.nullable()` are unwrapped first, so
`z.number().optional()` still gets a number input. Two things will bite you:

- **`configSchema` must be a plain `z.object({...})` at the top level.** Wrap it
  in `.refine()` and `.shape` is `undefined`, so the form renders _zero fields
  with no error_.
- There is no list or object editor. `news` handles a list of feeds as
  `z.string()` and splits the text itself.

---

## Stage 2 — a widget with a real integration

Anything that needs a credential or a server-side fetch follows the same four
pieces every time. This mirrors
[`gitlab-open-mrs`](../packages/widgets/src/gitlab-open-mrs/index.tsx).

```
widget  →  /api/<name>  →  throughCache  →  adapter  →  the provider
           (nodejs)        (SQLite, SWR)   (packages/integrations)
                ↑
        the credential store — read here and nowhere else
```

**1. The adapter** (`packages/integrations/src/acme.ts`) knows the provider and
nothing about cockpit. Fail through `integrationError`, never a bare `Error`:

```ts
import { integrationError } from "./errors";
import { assertFetchableUrl } from "./net";

export interface AcmeConfig {
  baseUrl: string;
  token: string;
}

export async function listThings(
  config: AcmeConfig,
  signal?: AbortSignal,
): Promise<Thing[]> {
  const base = assertFetchableUrl(config.baseUrl, "The Acme base URL").origin;
  const res = await fetch(`${base}/api/things`, {
    headers: { authorization: `Bearer ${config.token}` },
    signal,
  });
  // 401/403 become an IntegrationAuthError carrying Acme's own explanation,
  // which is what makes the widget offer "reconnect" instead of a dead string.
  if (!res.ok) throw await integrationError("Acme", res, "Acme request");
  return (await res.json()) as Thing[];
}
```

Validate any URL you are about to fetch. `assertFetchableUrl` allows private
hosts (a self-hosted instance is normal); `assertPublicHttpUrl` does not, and is
what you want for a URL an unauthenticated caller could supply. See
[`net.ts`](../packages/integrations/src/net.ts).

**2. A cache helper** in
[`integration-cache.ts`](../apps/web/lib/integration-cache.ts). `throughCache`
loads the credential, serves fresh cache, falls back to stale cache on error,
and flags auth failures:

```ts
export const getAcmeData = (force = false) =>
  throughCache<AcmeConfig>("acme", (c) => listThings(c), force);
```

It returns `{ configured, items?, error?, authFailed?, cachedAt? }` — the shape
your `Data` interface should mirror. For a keyless source use `cachedFetch(key,
fetcher, ttlMs, force)` instead, as `weather` and `news` do.

**3. The route** (`apps/web/app/api/acme/route.ts`) is a one-liner. It must be
`nodejs` — the credential store and SQLite are not available on Edge:

```ts
import { NextResponse } from "next/server";
import { getAcmeData } from "@/lib/integration-cache";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  return NextResponse.json(await getAcmeData(force));
}
```

**4. The widget** declares a `connection` and handles the two states a
credentialed widget has that a keyless one doesn't:

```tsx
import { ConnectPrompt, ReconnectPrompt } from "../lib/connect";

interface Data {
  configured: boolean;
  items?: Thing[];
  error?: string;
  authFailed?: boolean;
}

function Panel({ data, onOpenSettings }: WidgetComponentProps<Config, Data>) {
  if (!data.configured) {
    return <ConnectPrompt label="Acme" onConnect={onOpenSettings} />;
  }
  if (data.authFailed) {
    return (
      <ReconnectPrompt
        label="Acme"
        detail={data.error}
        onReconnect={onOpenSettings}
      />
    );
  }
  return <ThingList items={data.items ?? []} />;
}

export default defineWidget<Config, Data>({
  // …
  connection: {
    provider: "acme",
    label: "Acme",
    fields: [
      { key: "baseUrl", label: "Base URL", defaultValue: "https://acme.test" },
      { key: "token", label: "API token", secret: true, placeholder: "acme_…" },
    ],
  },
  data: {
    queryKey: (_config, profileId) => ["acme", profileId],
    queryFn: async (ctx) => {
      const res = await fetch(`/api/acme${ctx.force ? "?refresh=1" : ""}`, {
        signal: ctx.signal,
      });
      if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
      return (await res.json()) as Data;
    },
    refetchIntervalMs: 5 * 60_000,
    staleTimeMs: 60_000,
  },
});
```

Connections are keyed by `provider`, not by widget, so two widgets and the
assistant naming `"acme"` share one stored credential. A `secret: true` field is
rendered as a password and **never** sent back to the browser — which is why
saving a multi-field connection requires re-entering every field, not just the
one you changed.

Add the provider to the `Provider` union in
[`apps/web/lib/credentials.ts`](../apps/web/lib/credentials.ts).

---

## Styling

The look is a warm neumorphism called _Atelier_, defined entirely in
[`apps/web/lib/theme.ts`](../apps/web/lib/theme.ts). **Never hardcode a colour.**

- **Surfaces** are `layerStyle`s, not colours: `tile` (a card), `raised` (a
  control that sits proud), `inset` (a recessed track). In Chakra v3 a gradient
  is not a colour token, so `bg="tile"` is wrong — use `layerStyle="tile"`.
- **Text**: `fg` for content, `fg.muted` for secondary, `fg.faint` for
  decoration only (eyebrows, dividers) — never for information.
- **Text styles**: `textStyle="label"` for uppercase mono eyebrows,
  `"data"` for numbers and ids (tabular figures), `"meta"` for row metadata.
- **Accent**: `accent`, `accent.solid` (contrast-safe on light surfaces),
  `accent.tint`. It re-tints per desk, so never assume a hue.
- **Status**: `status.review`, `status.waiting`, `status.merged`,
  `status.closed`. Always pair colour with a shape or word — colour alone fails
  accessibility.

Widget bodies are `container-type: inline-size`, so reflow with
`@container widget (min-width: …)` rather than viewport breakpoints or props
from the host.

On phones (< 768px) the grid becomes a single read-only column in desktop
reading order. Set `mobileH` where the desktop height reads wrong at full width,
and `mobileHidden: true` to drop the widget from phones entirely.

---

## Talking to the assistant

Return a string (or `{ title, summary }`) from `describe(config, data)` and the
host publishes it as a `widget:context` signal on the desk's bus whenever the
data changes, removing it when the widget unmounts. The assistant widget reads
those signals and sends them as context. You never emit anything by hand.

Write it as one sentence of plain fact — "3 MRs waiting on your review, oldest
4 days" — not a command. The assistant treats it strictly as data.

---

## Before you ship

- No secret in `config`; secrets go through `connection`.
- Every fetch goes to `/api/*`, and passes `ctx.signal`.
- Handles not-configured, auth-failed, error, empty and loaded.
- `mobileH` set, or a deliberate `mobileHidden`.
- Colours come from tokens; surfaces from `layerStyle`.
- `describe()` written if the assistant should know about it.
- Added to `definitions` in `registry.ts`.
- `pnpm check-types` passes.

## When a widget outgrows this

If it owns a data model, rules of its own, and LLM or database access, keep the
layering — pure `domain/` → `application/` → `infrastructure/` →
`composition.ts` — inside the widget's own `server/` folder (see
[Where a widget lives](#where-a-widget-lives)). `language-learning` shows the
layering in
[`ARCHITECTURE.md`](../packages/widgets/src/language-learning/ARCHITECTURE.md);
its slice still sits under `apps/web/lib/language-learning/` until it is
ported. See also [architecture.md](architecture.md#domain-rich-widgets).

## Known gap

Widget config is validated against `configSchema` in the browser but only
structurally on the server (shape, size, nesting — see
[`widget-config.ts`](../apps/web/lib/widget-config.ts)), because most widget
modules are `"use client"` and a route handler importing the registry would get
client references instead of real schemas. The framework-free `config.ts` in
the widget folder (see [Where a widget lives](#where-a-widget-lives)) is the
schema's home for exactly this reason; wiring the server to validate against it
is still open. Until then, validate anything that reaches a server-side fetch at
the point it is consumed.
