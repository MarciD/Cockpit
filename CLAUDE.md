# CLAUDE.md — cockpit

Guidance for working in this repo. (User's global preferences still apply.)

## What this is

A local-first personal dashboard: per-desk pages of configurable widgets +
a Claude assistant. Turborepo + pnpm, Next.js 15 (App Router, React 19), Chakra
UI v3, TanStack Query v5, react-grid-layout v2, Drizzle + better-sqlite3, croner.
`docs/architecture.md` has the full picture; `docs/widgets.md` is the widget
contract + a worked example; `SECURITY.md` has the threat model.

## Ground rules

- **No automated tests** — personal project (explicit user decision). Verify by
  `pnpm check-types`, `pnpm build`, and driving the app (Playwright MCP against
  `localhost:4000`). Don't add a test framework unless asked.
- **One folder per widget (firm rule, 2026-09-09).** Everything a widget owns
  lives in `packages/widgets/src/<widget>/`: `README.md` (what it does, how it
  looks, its settings, routes, tables, jobs, notifications) with
  `screenshots/`, `index.tsx` (tile), `config.ts`, `types.ts`, `ui/`, `page/`,
  and — when it has server logic — `server/` (`import "server-only"`;
  `schema.ts`, pure `domain/` → `application/` → `infrastructure/` →
  `composition.ts`, `routes.ts`, `jobs.ts`). Widget-specific adapters live in
  the widget; `packages/integrations` keeps only shared pieces. `apps/web`
  holds generic glue and cross-cutting services (notifications, images,
  credentials, integration cache, scheduler). Layout, rules and migration
  status: `docs/widgets.md#where-a-widget-lives`. **Existing widgets predate
  the rule** — their server pieces are still spread over
  `packages/integrations`, `apps/web/lib` and `apps/web/app/api/*`
  (`language-learning` has the whole slice under `apps/web/lib`). Port one when
  you next touch it; never add a new widget in the old shape. The generic glue
  (server registry, `/api/w/[widget]` route, scheduler hook, drizzle-kit glob)
  does not exist yet and lands with the first server-side widget built under
  the rule. LLM access = the shared `anthropic` API key via
  `getProviderConfig` (never the Claude subscription — Anthropic disallows
  programmatic subscription use).
- Keep the Atelier look: tokens/`layerStyles` in `apps/web/lib/theme.ts`
  (`tile`/`raised`/`inset`, `accent`, `status.*`); never hardcode hex — use tokens.

## Hard invariants (do not break)

- **Widget `config` is client-visible** (merged in the browser, passed to the
  Component). Never put a secret in `config`. Secrets go through a widget
  `connection` → server `CredentialStore`, read only in `/api/*` routes.
- **Widgets fetch only via `/api/*`** (nodejs routes). They never import the db,
  `integration-cache`, or credentials directly.
- **`WidgetComponentProps` is `{ config, data, onOpenSettings }`** — adding props
  is fine (additive), but keep existing widgets' `{ config, data }` destructure
  working.
- **Validate every URL before a server-side fetch** —
  `assertPublicHttpUrl` for anything a client can supply (feeds, iCal),
  `assertFetchableUrl` for an operator-typed provider base URL (private hosts
  allowed there). `packages/integrations/src/net.ts`.
- **`apps/web/middleware.ts` enforces same-origin** on every non-GET and every
  `/api/*` request, and gates everything behind `COCKPIT_ACCESS_TOKEN` when that
  is set. Adding a route means it is covered by default; exempting one means
  editing `PUBLIC_PATHS`.
- The Anthropic key + all provider creds live in the shared `CredentialStore`
  (`apps/web/lib/credentials.ts`), keyed by provider. A widget's `connection`
  declares `{ provider, fields }`; the config form saves via `/api/credentials/[provider]`.

## Key mechanisms

- **Signal bus** (`@cockpit/widget-sdk/signals`, client-only subpath): desk-scoped
  `useSyncExternalStore`. Widgets don't emit manually — the host (`widget-card.tsx`)
  auto-publishes `widget:context` from a widget's `describe()`. Keep `index.ts`
  React-free (types only); runtime hooks live in `signals.tsx`.
- **Assistant** (`apps/web/app/api/assistant/route.ts`): Anthropic SDK **Tool
  Runner** with `stream: true`, read-only tools wrapping `integration-cache` + db
  reads. `profileId` is bound server-side (never model-chosen); no tool takes a
  free URL (SSRF); desk context + tool output are framed as untrusted DATA.
- **Credential rejection**: adapters throw `await integrationError(provider, res, what)`
  (`packages/integrations/src/errors.ts`) instead of a bare `Error` — 401/403 become
  an `IntegrationAuthError` carrying the provider's own `error_description`.
  `throughCache` flags those payloads `authFailed: true`, and the widget renders
  `ReconnectPrompt` (`widgets/src/lib/connect.tsx`) rather than a dead red string.
  Non-auth errors keep serving the stale cache under an inline "showing cached
  data" note — never blank a widget over one failed refresh.
- **Scheduler**: started once in `apps/web/instrumentation.ts` (guarded by
  `NEXT_RUNTIME === "nodejs"`), globalThis singletons for db + scheduler.
- **Session resume** (language-learning): an in-progress topic session is persisted
  client-side via `usePersistentState` (localStorage, versioned `cockpit:ll:v1:` key
  per profile+language) — the `{ session, cursor }` envelope, so a crash/reload
  rehydrates the plan and place (verb sub-progress re-fetches, by design). The
  panels are wrapped in `SessionErrorBoundary`: a render throw shows a Resume /
  Start-over card instead of blanking the widget (Start over clears the key). No
  server state — local-first, per-browser.
- **Responsive grid** (`grid-board.tsx`): one RGL `ResponsiveGridLayout`. Phones
  (< 768px, derived from the **container** width so it matches what RGL renders —
  not Chakra breakpoints) get a generated single-column, **read-only** stack in
  desktop reading order (`buildMobileLayout`, injected as `xs`/`xxs`, never
  persisted); drag/resize/remove are gated `!isMobile`. Per-widget mobile sizing
  via `layout.mobileH` / `layout.mobileHidden`. Chrome swaps the 72px rail for a
  bottom `ProfileTabBar` at Chakra `md`; `viewport-fit=cover` +
  `env(safe-area-inset-*)` live in `app/layout.tsx` + `app-shell.tsx`. Widget
  bodies are `container-type: inline-size` (`widget-card.tsx`) so widgets can add
  `@container widget (...)` reflow without host changes.

## Gotchas (learned the hard way)

- **Anthropic SDK + Zod v3:** `betaZodTool` is typed for Zod v4 → use `betaTool`
  (raw JSON Schema, `as const` on the schema) from `@anthropic-ai/sdk/helpers/beta/json-schema`.
  Get SDK/model specifics from the bundled `claude-api` skill; model tiers:
  `fast`→`claude-haiku-4-5`, `balanced`→`claude-sonnet-5`, `deep`→`claude-opus-4-8`.
- **Zod stays on v3, deliberately.** `widget-config-form.tsx` builds the
  settings form by reading `_def.typeName` off each schema field, which Zod 4
  removes, and `@hookform/resolvers@3`'s `zodResolver` throws outright on a v4
  schema. A v4 bump therefore turns every widget setting into a plain text
  input _and_ stops the form validating — with no type error and no test to
  catch it. Migrating means resolvers v5+, rewriting `buildFields` against
  `_zod.def.type`, and re-checking all ten widgets' settings. Dependabot is
  configured to stop proposing the major.
- **Next stays on 15.** Next 16 enables Turbopack by default and errors on the
  `webpack()` config in `next.config.mjs` — which is load-bearing: it keeps
  `better-sqlite3` / `node-ical` / `fast-xml-parser` out of the server bundle,
  because `serverExternalPackages` alone doesn't cover a dep reached through a
  transpiled workspace package. Migrating means proving Turbopack keeps them
  external; a silently bundled native module fails at runtime, not at build time.
- **node-ical stays on 0.20.** 0.27 moved date handling to Temporal, so the
  event types `google-calendar.ts` reads change from `Date` to `{}`. Plausibly
  the right fix for the calendar-timezone rough edge below, but it needs
  verifying against real feeds, recurrence and DST.
- **better-sqlite3 stays on v11.** v13 ships no prebuilt binary, so it falls
  back to node-gyp, and the production image has no compiler — the Docker build
  fails at `pnpm install --prod`.
- **`structuredCall` output is NOT schema-validated.** The API treats `input_schema`
  as a hint, not a contract — the model (esp. `fast`/Haiku) can omit a `required`
  field or return the wrong type. `structuredCall<T>` just casts `block.input as T`.
  Every adapter MUST normalize the raw output into its domain object before returning
  (coerce arrays/strings, drop malformed entries) — see `toGrade`/`toTopicPlan`.
  Skipping this crashed the client on `grade.warnings.map` when `warnings` came back
  missing.
- **Native / heavy deps** (`better-sqlite3`, `node-ical`, `fast-xml-parser`) are in
  `serverExternalPackages` **and** the webpack `externals` list in `next.config.ts`
  (they're pulled through transpiled workspace packages, so both are needed).
- **CSS cascade layers:** overrides that must beat Chakra's layers or un-layered
  vendor CSS (the RGL red placeholder, the focus ring, reduced-motion) live in
  `apps/web/app/globals.css`, not the theme's `globalCss`.
- **Chakra v3:** gradients aren't color tokens — put gradient strings inside
  `layerStyles.*.background` (never `bg="tile"`). `color-mix` is used for
  `accent.solid`/`accent.tint`.
- **Per-desk accent:** `profile-view.tsx` sets the resolved `--chakra-colors-accent*`
  vars on the desk wrapper (Chakra resolves `var(--accent)` at `:root`, so setting
  only `--accent` wouldn't re-tint the tokens).
- **GitLab reviewer state under-reports.** `/merge_requests/:iid/reviewers` leaves
  `state: "unreviewed"` even while that person runs a whole comment thread, and
  `/approvals` reports `approvals_left: 0` vacuously on projects that require zero
  approvals. So "has this reviewer engaged?" = `state` ∪ non-system notes, and
  "is it approved?" needs `approved && approved_by.length > 0` — never either alone.
- **Never run `pnpm build` while `next dev` is up** — they share `apps/web/.next`,
  so the production build overwrites the dev server's compiled route chunks and
  unrelated routes start returning 500. Verify with `pnpm check-types` + live
  requests instead; if it happens, kill dev, `rm -rf apps/web/.next`, restart.
- **Dependabot auto-merge fails silently in four different ways.** All four
  were live at once here. (1) `fetch-metadata` reports the _highest_ bump in a
  grouped PR, so gating on `version-update:semver-patch` never fires while
  updates are grouped — gate on the `dependency-group` name (`stable`).
  (2) GitHub **removed the `@dependabot merge` / `squash and merge` comment
  commands in January 2026**; posting one now gets no reply, no reaction and no
  error. (3) GitHub turns `require_extra_approval_for_unattributed_changes` on
  by default in every ruleset, new and existing: it demands one approval _more_
  than configured for a bot-authored PR, unsatisfiable with one maintainer.
  (4) "Restrict updates" (`update`) blocks PR merges by any non-bypass actor,
  and is redundant next to a `pull_request` rule. So the workflow now approves
  the PR itself — needs "Allow GitHub Actions to create and approve pull
  requests" — and merges; nothing is bypassed, so `required_status_checks` in
  the _other_ ruleset still gates it server-side. Don't reach for a bypass
  actor: `gh pr merge --auto` ignores `bypass_actors` (only the synchronous
  merge endpoint honours them), and GitHub rejects the Actions app as a bypass
  actor on a user-owned repo — "must be part of the ruleset source or owner
  organization". Read effective rules with
  `gh api repos/{owner}/{repo}/rules/branches/main`; the per-ruleset view hides
  that rulesets aggregate to the most restrictive. Ruleset writes are
  `PUT /repos/{owner}/{repo}/rulesets/{id}` — PATCH 404s.
- **croner's `catch` defaults to `false`**, and that default is fatal: croner
  then awaits the job function unguarded, so anything a job throws becomes an
  unhandled rejection and Node exits — silently, from the outside. Every
  `new Cron` in `scheduler.ts` passes `catch: onJobError`, a function rather
  than `true` so a broken job is visible instead of invisibly dead. Work started
  outside croner (the boot warm-up) needs its own `.catch()`.
- **`next start` renames its process to `next-server (v…)`**, so a
  `pkill -f "next-server"` run in _any_ other repo on this machine kills
  cockpit's production server. It arrives as SIGTERM, Next shuts down
  gracefully and exits 0, so there is no crash, no stack trace and no log —
  which makes it look like the app died on its own. Kill dev servers by port
  (`lsof -ti:4000 | xargs -r kill`), not by name; the retitled process keeps no
  path in its argv, so a name pattern cannot be scoped to one project.
- **Local hooks are in `.githooks/`** (wired by the root `prepare` script):
  pre-commit blocks staged secrets/databases and Prettier-checks staged files;
  pre-push runs `check-types`. Neither builds — `next build` clobbers a running
  dev server's `.next`, and the image build belongs in CI.
- **After deleting a route**, stale `apps/web/.next/types/**` can fail `check-types`
  — clear `.next/types` (or rebuild).
- pnpm lives at `~/.local/share/pnpm/bin` — `export PATH="$HOME/.local/share/pnpm/bin:$PATH"`.
  The dev server runs on **4000**; `next start` and Docker run on 3000. Kill
  stray servers before restarting.
- **`COCKPIT_SECRET` is required** — the credential store refuses to build
  without it. Locally it lives in `apps/web/.env.local` (gitignored); Next loads
  that automatically, so `pnpm dev` needs no env prefix.
- **Turborepo 2 runs tasks in strict env mode.** A `COCKPIT_*` var exported in
  the shell will NOT reach a task unless it is listed in `turbo.json`'s
  `globalPassThroughEnv`.

## Known rough edges / TODO

- Calendar timezone handling in `packages/integrations/src/google-calendar.ts` is
  best-effort (single iCal feed); a multi-calendar + views + video-link + correct-TZ
  rework is planned.
- `chat_messages` / `usage_events` / `suggestions` tables exist but the assistant
  doesn't persist history yet, and the usage→widget-suggestion loop isn't built.
- Global settings / global API keys are deferred (creds are per-widget for now).
- **Widget layout migration.** None of the ten widgets has a `README.md` +
  `screenshots/` yet, and nine keep server code outside their folder (see the
  one-folder rule above). READMEs first, moves when a widget is next touched.
