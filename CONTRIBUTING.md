# Contributing

cockpit is a personal project I use every day. It's public because the widget
architecture might be useful to someone, not because it's looking for
maintainers — so please calibrate expectations: I may be slow, and I may decline
things that are perfectly good but not what I want to maintain.

That said, these are genuinely welcome:

- **Bug reports**, with your setup (Docker or native) and what the logs said.
- **Security reports** — privately, please: see [SECURITY.md](SECURITY.md).
- **New widgets.** This is the part built to be extended.
- **Fixes** for the rough edges listed in [CLAUDE.md](CLAUDE.md).

Please open an issue before a large change, so neither of us wastes an evening.

## Getting set up

```sh
pnpm install                              # Node >= 22, pnpm 11
echo "COCKPIT_SECRET=$(openssl rand -base64 32)" > apps/web/.env.local
pnpm dev                                  # http://localhost:4000
```

`pnpm install` also points `core.hooksPath` at [`.githooks/`](.githooks), so you
get two local checks:

| Hook         | What it does                                                       | Budget   |
| ------------ | ------------------------------------------------------------------ | -------- |
| `pre-commit` | refuses staged secrets or databases, then Prettier on staged files | < 1s     |
| `pre-push`   | `pnpm check-types`                                                 | ~1s warm |

They are a convenience, not a guarantee — they only run where they are
installed, so they say nothing about a fork's code. The production build and the
Docker image deliberately stay in CI, which does see every pull request. If a
hook is ever in your way, `--no-verify` is there; CI will catch it.

Migrations run at boot, so there is no separate database step. `pnpm --filter
@cockpit/db db:seed` gives you a demo desk with keyless widgets.

Read [docs/architecture.md](docs/architecture.md) for the shape of the thing, and
[docs/widgets.md](docs/widgets.md) if you're adding a widget — it has a full
worked example.

## What CI checks

```sh
pnpm exec prettier --check "**/*.{ts,tsx,mjs,md,json,yaml,yml}"
pnpm check-types
pnpm build
docker build .
```

Run those before opening a PR. Two things to know:

- **Never run `pnpm build` while `pnpm dev` is running.** They share
  `apps/web/.next`, and the production build overwrites the dev server's route
  chunks — unrelated routes start returning 500. If it happens: stop dev,
  `rm -rf apps/web/.next`, restart.
- There are **no automated tests** and **no ESLint**, deliberately. TypeScript
  and Prettier are the whole toolchain. Please don't add either in a PR; verify
  by driving the app.

## House style

- Match the surrounding code over any personal preference.
- Prettier decides formatting: 80 columns, double quotes, semicolons, trailing
  commas. `pnpm format` fixes it.
- Named exports; `const` by default; explicit return types on exported
  functions; early returns over nesting.
- No colour literals in components — use the theme tokens and `layerStyle`s. See
  the styling section of [docs/widgets.md](docs/widgets.md#styling).
- Comments explain _why_, not _what_. The interesting ones here document a trap
  someone already fell into; keep that habit.

## Hard invariants

Breaking one of these breaks the security model or every existing widget:

- Widget `config` is client-visible. **Never put a secret in it.**
- Widgets fetch only via `/api/*`. They never import the database, the
  integration cache, or credentials.
- `WidgetComponentProps` is `{ config, data, onOpenSettings }`. Adding props is
  fine; changing or removing those is not.
- Adapters throw `await integrationError(provider, res, what)`, not a bare
  `Error`, so a rejected credential can render a Reconnect prompt.
- Validate any URL before a server-side fetch — see
  `packages/integrations/src/net.ts`.

## How changes land

`main` is protected by two rulesets. Everyone, including me, goes through a pull
request:

- **Protected main** — both CI jobs must pass, history stays linear, squash-only,
  no force pushes or deletions.
- **Maintainer review** — one approving review from the code owner
  ([CODEOWNERS](.github/CODEOWNERS)), stale reviews dismissed on a new push, and
  review threads resolved before merge.

There are no other collaborators, so contributions come from forks. I'm the only
one who can approve.

The one exception is Dependabot's **`stable`** group — minors and patches of
dependencies at 1.0 or above — which merges itself once CI is green. Below 1.0
semver permits a breaking minor, and one has broken this repo (`drizzle-orm`
0.38 → 0.45), so those arrive as a separate `pre-1-0` PR. That group and every
major stay manual: a green CI run in a repo with no tests means "it compiles and
boots", not "it still works".

Dependabot bypasses the review ruleset but not the status-check one, which is
why the two are separate — a bypass actor is exempt from _every_ rule in its own
ruleset, so folding them together would let a bot merge without CI.

## Commits and PRs

Short imperative subjects ("add sunrise widget", "fix calendar timezone drift").
Branches are `<type>/<description>`, type one of `feat`, `fix`, `chore`, `docs`,
`refactor`.

In the PR, say what you changed, why, and how you verified it. Screenshots for
anything visual.

## Licensing of contributions

cockpit is under the [PolyForm Noncommercial 1.0.0](LICENSE) license — source
available rather than open source: noncommercial use is free, commercial use
needs written permission. By opening a pull request you agree your contribution
is licensed on those same terms. If that doesn't work for you, please don't
submit code — an issue describing the idea is still very welcome.
