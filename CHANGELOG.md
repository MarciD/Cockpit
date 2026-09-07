# Changelog

Notable changes per release. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are
[semver](https://semver.org/), with the caveat that this is a personal project
at 0.x — minor bumps may still change behaviour.

## [Unreleased]

### Fixed

- Dependabot auto-merge had never once fired. GitHub enables
  `require_extra_approval_for_unattributed_changes` by default on new _and
  existing_ rulesets; it demands one approval more than configured for a
  bot-authored pull request, which a single-maintainer repo cannot supply. A
  redundant "restrict updates" rule also kept every actor but me from writing to
  `main`, so Dependabot could not have merged even once approved. Both are gone;
  the approval and status-check rules are otherwise untouched.
- The auto-merge gate matched `version-update:semver-patch`, but
  `fetch-metadata` reports the _highest_ bump in a grouped pull request, so every
  grouped update read as `semver-minor` and was skipped. It now gates on the
  dependency group instead.
- `.dockerignore` patterns are not recursive, so a nested `.env.local` was
  copied into locally built images. Every pattern is now `**/`-anchored, and CI
  asserts that a built image contains no env files, databases, keys or `.git`.
- A failed boot (a missing `COCKPIT_SECRET`, say) left the process alive, so
  Docker reported a container as running that could never serve. It now exits
  non-zero, and CI asserts that too.

### Changed

- Dependabot's single `minor-and-patch` group is split in two, on whether semver
  promises anything: `stable` (dependencies at 1.0 or above) auto-merges its
  minors and patches, while `pre-1-0` (`@anthropic-ai/sdk`, `drizzle-orm`,
  `drizzle-kit`, `node-ical`) stays manual.
- `croner` 9 → 10 and `@hookform/resolvers` 3 → 5. Both majors, both verified
  against the way this repo actually uses them: croner's `(pattern, {name,
protect}, fn)` constructor still fires and stops, and `zodResolver` still
  validates a Zod 3 schema — which also unblocks a future Zod 4 migration,
  since resolvers 5 supports both.
- `@anthropic-ai/sdk` 0.110 → 0.122. Verified live rather than on green types:
  the beta Tool Runner streams, executes a real tool call against GitLab, and
  `messages.create` still returns a conjugation table.
- Pinned three more dependencies with the reasons recorded in `CLAUDE.md`:
  `next` (16 defaults to Turbopack and rejects the load-bearing `webpack`
  config), `node-ical` (0.27's Temporal switch changes the calendar event
  types), and `node-ical` is excluded from Dependabot's patch group so one
  breaking dependency can't block the safe ones.

- Reverted two dependency majors that were merged and turned out to break the
  app: `zod` 4 (every widget settings field became a plain text input and the
  form stopped validating) and `better-sqlite3` 13 (no prebuilt binary, so the
  production image cannot build). Both are documented in `CLAUDE.md` and
  Dependabot no longer proposes the major.

### Security

- Every dependency advisory on the default branch closed: `next` 15.5.24,
  `drizzle-orm` 0.45.2, `fast-xml-parser` 5.11.1, `sharp` 0.35.4, plus
  `postcss`, `uuid` and `esbuild` via pinned overrides where a parent held them
  back.

## [0.1.0] — 2026-08-31

First public release. cockpit had been in daily private use for a while; this is
the point it became something someone else could run.

### Added

- Desks: create, rename, recolour and delete pages of widgets, with a two-letter
  rail monogram per desk. cockpit ships with none — the first run creates one.
- Ten widgets: GitLab merge requests (with approval and reviewer state), Jira
  issues, calendar (multiple iCal feeds), weather, news, to-dos, recurring tasks,
  a config-only custom API tile, a read-only Claude assistant, and a
  language-learning trainer with its own full page.
- A `defineWidget()` contract with an auto-generated settings form, a
  stale-while-revalidate cache over SQLite, and a desk-scoped signal bus that
  feeds each widget's one-line summary to the assistant.
- Per-widget credential connections, shared by provider, encrypted at rest with
  AES-256-GCM under `COCKPIT_SECRET` and readable only inside `/api/*` handlers.
- Docker: one container, one volume, migrations on boot, published multi-arch to
  `ghcr.io/marcid/cockpit` with build provenance.
- Optional `COCKPIT_ACCESS_TOKEN` gate, so serving the app to a LAN is
  defensible rather than reckless.
- Documentation: architecture, a widget-building guide with a worked example,
  self-hosting, and a threat model that states the limits plainly.

### Security

- `COCKPIT_SECRET` is mandatory. Earlier revisions fell back to a hardcoded
  passphrase, which would have been published with this source; any record still
  encrypted under it is transparently re-encrypted on first read.
- Server-side fetches of client-supplied URLs (RSS feeds, iCal addresses) reject
  loopback, private, link-local and cloud-metadata hosts. Operator-supplied
  provider base URLs still allow private hosts, since a self-hosted GitLab is a
  normal setup.
- A same-origin check refuses cross-origin state-changing requests and any
  cross-site `/api/*` request, so a page you visit cannot drive your dashboard.
- Credential-file writes are serialized; concurrent read-modify-write cycles
  could previously clobber each other.
- `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and
  `Permissions-Policy` are set on every response.

[Unreleased]: https://github.com/MarciD/Cockpit/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/MarciD/Cockpit/releases/tag/v0.1.0
