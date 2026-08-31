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
