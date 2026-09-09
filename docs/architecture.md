# Architecture

cockpit is one Next.js process with a SQLite file next to it. There is no
service to deploy, no queue, no external database. That constraint is the design
— everything below follows from "it runs on your own machine and the data stays
there".

## The workspace

Turborepo + pnpm. One app, five packages:

```
apps/web                  Next.js 15 (App Router) — UI, /api routes, the scheduler
packages/widget-sdk       the defineWidget() contract + the signal bus
packages/widgets          the widget catalog, one folder each
packages/integrations     provider adapters + the credential store + the URL guard
packages/db               Drizzle schema, queries, migrations (better-sqlite3)
packages/project-setup    shared tsconfig + Prettier config
```

The workspace packages ship **TypeScript source**, not build output: none of
them has a `build` script, and `next.config.mjs` lists them in
`transpilePackages` so Next compiles them inline. `turbo run build` therefore
resolves to a single `next build`.

## Layers

```
        browser                            server (nodejs)
  ┌──────────────────┐              ┌──────────────────────────┐
  │ widget component │──fetch──────▶│ /api/* route handler     │
  │  (client only)   │              │  ├─ credential store     │
  └──────────────────┘              │  ├─ integration cache    │
           ▲                        │  │    └─ provider adapter│──▶ GitLab,
           │ props                  │  └─ SQLite (Drizzle)     │    Jira, iCal,
  ┌──────────────────┐              └──────────────────────────┘    Open-Meteo,
  │ server component │───────────────────────▶ SQLite (direct)      RSS, Claude
  └──────────────────┘
```

The `/api/*` boundary is the whole security model. Widgets are client
components; they cannot import the database, the cache, or a credential, because
those only exist on the Node side of that line. Server components read the
database directly for the initial render (desks, widget instances, layouts) —
that path is server-only and never ships a credential to the browser.

Every route handler declares `export const runtime = "nodejs"`. Edge cannot load
`better-sqlite3` or decrypt the credential file.

## Data flow for one widget

1. The host (`widget-card.tsx`) merges `defaultConfig` under the instance's
   stored config **in the browser** and runs one TanStack Query per instance.
2. `queryFn` fetches `/api/<thing>` with the query's `AbortSignal`.
3. The route calls a helper in `apps/web/lib/integration-cache.ts`.
4. `throughCache` loads the provider's credential, then either serves a fresh
   cache row, or fetches live through the adapter and caches the result.
5. The adapter talks to the provider and throws `integrationError(...)` on a bad
   response.

### Caching, and why a widget never blanks

One `cache` table, keyed by a string, holding a JSON payload and a timestamp;
stale-while-revalidate with a 5-minute TTL. The interesting part is failure
handling:

- **The provider rejected the credential** (401/403) → the adapter throws
  `IntegrationAuthError` carrying the provider's _own_ explanation. The cache
  flags the payload `authFailed: true`, and the widget renders a **Reconnect**
  prompt with that explanation. "Your token expired" instead of "HTTP 401".
- **Anything else failed** → the last good cached payload is still returned,
  with `error` set, so the widget shows real data under an inline "showing
  cached data" note. One flaky refresh never empties a tile.

That distinction is why adapters must throw `await integrationError(provider,
res, what)` rather than a bare `Error`.

## Credentials

Secrets never touch widget `config` (which is client-visible). A widget declares
a `connection: { provider, label, fields }`; the settings form posts it to
`/api/credentials/[provider]`, which stores it server-side keyed by _provider_.
Two widgets and the assistant naming the same provider share one credential.

Storage is either an AES-256-GCM encrypted JSON file (`data/credentials.enc`,
mode 0600 — scrypt key derivation, a fresh random salt and IV per record) or the
macOS Keychain with `COCKPIT_KEYCHAIN=1`. The file store's passphrase is
`COCKPIT_SECRET`, which is **required**: cockpit refuses to boot without it.
Rotating it is free — a record that only opens with an older passphrase is
transparently re-encrypted under the current one on first read.

## The scheduler

`apps/web/instrumentation.ts` runs once at server boot. Inside a
`process.env.NEXT_RUNTIME === "nodejs"` guard (which is what lets Next
dead-code-eliminate the Node-only tree out of the Edge bundle) it dynamically
imports `lib/boot.ts`, which:

1. asserts the credential store is configured, so a missing secret fails at boot
   rather than on the first widget request;
2. applies pending migrations — idempotent, so a fresh install and every
   container start set themselves up;
3. starts the croner scheduler.

The scheduler keeps integration caches warm every 5 minutes and runs one cron
job per enabled recurring task. It has **no cross-process lock**: run exactly one
instance, or every process will run every job against the same SQLite file.

## Notifications

One server-side entry point, `notify()` in `apps/web/lib/notifications`, and
one table. The row is the inbox entry and the source of truth; delivery
channels (a phone push, a desktop banner) fan out from it and may fail without
losing it. `notify()` never throws — its callers are scheduled jobs and cache
refreshes that must not die over a notification — and it collapses rows that
share a `dedupeKey` inside a window, so a flapping job or a rejected token is
reported once, not every five minutes.

Producers live where the knowledge is: a recurring task firing in the
scheduler, an `IntegrationAuthError` in `throughCache`, croner's `catch`
callback. The browser learns about new rows by polling `GET /api/notifications`
every 30 seconds from the bell in the rail (one shared TanStack query); rows
newer than the last poll become toasts, the unread count goes onto the
installed app's badge, and the inbox opens as the ordinary modal in a portal.
No SSE and no web push: the inbox has to be persisted anyway, and polling an
inbox is the whole cost.

## The signal bus

`@cockpit/widget-sdk/signals` is a client-only, desk-scoped pub/sub over
`useSyncExternalStore`. The store is recreated per desk id, so signals never leak
between desks.

Widgets do not emit by hand. If a widget defines `describe(config, data)`, the
host publishes the result as a `widget:context` signal whenever it changes and
removes it on unmount. The assistant widget subscribes and forwards those
summaries as context.

`index.ts` stays React-free (types plus one identity function) so it is safe in
any bundle; the runtime hooks live in `signals.tsx` behind the `./signals`
subpath.

## The assistant

`/api/assistant` runs the Anthropic SDK's Tool Runner with `stream: true` over
**read-only** tools: open MRs, Jira issues, today's events, weather, to-dos,
recurring tasks, and a branch-merge check. Deliberate constraints:

- `profileId` is bound server-side from the request, never chosen by the model.
- No tool takes a free-form URL, so the model cannot direct an outbound request.
- No tool writes anything.
- The desk context and every tool result are framed as untrusted **data**, never
  as instructions, and the prompt states that to-dos are the user's intentions
  rather than verified facts about the world.

The Anthropic key is a normal provider credential in the shared store, used
server-side only.

## The grid

One react-grid-layout `ResponsiveGridLayout`. Desktop layouts are persisted per
desk and per breakpoint. Phones (< 768px, measured from the _container_ width so
it matches what RGL actually renders, not a Chakra breakpoint) get a generated
single-column, **read-only** stack in desktop reading order — never persisted, so
using cockpit on a phone can't reshuffle the desktop layout. Drag, resize and
remove are gated off there.

## Theme

`apps/web/lib/theme.ts` holds the whole visual language: semantic colour tokens,
text styles, and the neumorphic surfaces as `layerStyles` (`tile`, `raised`,
`inset`). Gradients are not colour tokens in Chakra v3, which is why surfaces are
`layerStyle="tile"` and never `bg="tile"`. Each desk sets its accent by
overriding the _resolved_ `--chakra-colors-accent*` variables on its wrapper.

Overrides that must beat Chakra's cascade layers or un-layered vendor CSS live in
`apps/web/app/globals.css`, not in the theme.

## Domain-rich widgets

Most widgets are thin: fetch JSON, render it. When a widget owns a real domain —
its own data model, rules, and LLM or database access — the domain goes into the
widget's own `server/` folder as a layered slice. A widget is one folder:

```
packages/widgets/src/<widget>/
  README.md  screenshots/                what it is and what it looks like
  index.tsx  config.ts  types.ts  ui/  page/   the client half
  server/                                     the server half
    index.ts       import "server-only"
    schema.ts      its Drizzle tables
    domain/        pure — no framework, no db, no LLM imports
    application/   use cases over ports
    infrastructure/ adapters: Drizzle repositories, LLM clients, provider APIs
    composition.ts wires adapters to services
    routes.ts      handlers, mounted by the generic /api/w/[widget] route
    jobs.ts        cron jobs, registered by the scheduler
```

Dependencies point one way only: `domain → nothing`, `application → domain`,
`infrastructure → domain`, `routes and UI → everything below`. The client half
never imports `server/`; `server-only` makes that a build error. The rest holds
by structure, TypeScript, and review — there is no ESLint in this repo.

The HTTP boundary is what keeps the client widget and the server domain apart: a
full page is exported from the widget package on its own subpath and rendered by
a thin page route. Cross-cutting services (notifications, images, credentials,
the integration cache, the scheduler) stay in `apps/web/lib`; widget-specific
provider adapters live in the widget. `language-learning` shows the layering
(see [its ARCHITECTURE.md](../packages/widgets/src/language-learning/ARCHITECTURE.md))
but predates the one-folder rule: its slice still sits under
`apps/web/lib/language-learning/` with 17 route files until it is ported. The
rule, the layout and the migration status are in
[widgets.md](widgets.md#where-a-widget-lives).

## Deliberate omissions

- **No tests.** A personal project; verification is `pnpm check-types`,
  `pnpm build`, and driving the app.
- **No ESLint.** TypeScript plus Prettier, and CI runs both.
- **No `output: "standalone"`.** The native and heavy dependencies are webpack
  externals reached through transpiled workspace packages, and Next's file
  tracing does not reliably carry them across pnpm's symlinked `node_modules`.
  The Docker image installs production dependencies and runs `next start`.
- **No multi-user model.** See [SECURITY.md](../SECURITY.md).
