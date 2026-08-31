# Security

cockpit holds live credentials for your GitLab, Jira, calendar and Anthropic
accounts. This document says plainly what it does and does not protect, so you
can decide where to run it.

## Reporting a vulnerability

Use GitHub's **private vulnerability reporting** on this repository
(Security → Report a vulnerability). Please don't open a public issue for
something exploitable.

This is a personal project maintained in spare time. I'll acknowledge reports
and fix what's real, but there is no SLA and no bounty.

## The threat model in one paragraph

cockpit is a **single-user, local-first** application. It has no user accounts,
no per-desk authorization, and no session beyond an optional shared token. Any
request that reaches it and passes that token can read and modify everything:
every desk, every widget, and — through the widgets — every connected provider.
The security boundary is _who can reach the port_, not who they are.

## What that means in practice

**Bound to `127.0.0.1`, cockpit is as safe as any other app on your machine.**
That is the default: `compose.yaml` publishes on loopback only, and the macOS
LaunchAgent template passes `-H 127.0.0.1`.

**Reachable from anywhere else — a LAN, a phone, a reverse proxy — set
`COCKPIT_ACCESS_TOKEN`.** Every request then needs that token, entered once at
`/login` and kept in an httpOnly cookie, or sent as `Authorization: Bearer`.
It is one shared secret for the whole instance, not a login: treat it like the
password to all your integrations, because that is what it is.

**Never put cockpit on the public internet without authentication in front of
it.** Unauthenticated self-hosted tools get found and drained at scale.

## What is protected

**Secrets are never client-visible.** Widget `config` is merged in the browser,
so it may not hold a secret — that is a hard invariant of the widget contract.
Credentials go through a widget's `connection` into a server-side store and are
read only inside `/api/*` route handlers. A `secret: true` field is never sent
back to the browser, which is why editing a connection requires re-entering it.

**Credentials are encrypted at rest.** AES-256-GCM with scrypt key derivation, a
fresh random salt and IV per record, an authentication tag verified on read, in
a `0600` file. `COCKPIT_SECRET` is the passphrase and is mandatory — earlier
versions had a hardcoded fallback, which would have been published along with
this source. Records written under it are transparently re-encrypted on first
read. On macOS, `COCKPIT_KEYCHAIN=1` uses the system Keychain instead.

**Cross-origin requests are refused.** A same-origin check rejects any
state-changing request whose `Origin` doesn't match, and any `/api/*` request
arriving cross-site. Without it, every website you visit could make your browser
POST to `localhost:3000` or trigger a server-side fetch.

**Server-side fetches of client-supplied URLs are filtered.** RSS feeds and iCal
addresses are fetched by the server, so a URL naming `169.254.169.254`,
`127.0.0.1` or a LAN neighbour would turn cockpit into a network probe — the
scheduler would even repeat it every five minutes. Those are rejected;
`COCKPIT_ALLOW_PRIVATE_FETCH=1` opts out when your own feeds are internal.
Provider base URLs, which the operator types into a connection, deliberately
_do_ allow private hosts — a self-hosted GitLab on a LAN is a normal setup — but
still must be `http(s)` with no embedded credentials.

**The assistant is read-only.** It runs a fixed set of tools that only read. No
tool writes, and none takes a free-form URL, so the model cannot direct an
outbound request. `profileId` is bound server-side, never chosen by the model.
Desk context and tool output are framed as untrusted data, not instructions.

## Known limitations — accepted, not overlooked

- **No per-desk authorization.** Every route trusts a client-supplied
  `profileId`, and desk ids are listed on the home page. With the token gate on,
  everyone who has the token sees every desk. There is no way to share one desk
  and not another.
- **No rate limiting.** The assistant and the language-learning routes make real
  Anthropic API calls, and the caller picks the model tier — including the most
  expensive one. Cost is bounded by who can reach the port, not by a budget. Do
  not expose cockpit to people you wouldn't hand your API key.
- **Request bodies are validated by hand,** with `typeof` checks rather than a
  schema. Widget `config` is validated against its Zod schema only in the
  browser; the server checks shape, size and nesting. See the _Known gap_ in
  [docs/widgets.md](docs/widgets.md).
- **The URL filter checks names and literals, not resolved addresses.** A public
  hostname whose DNS points at a private address still passes. Closing that
  needs DNS-pinned connections, which is more machinery than a local-first
  dashboard warrants.
- **No Content-Security-Policy.** Chakra v3 emits styles at runtime, so a useful
  CSP needs a nonce pipeline this app doesn't have. `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy` are set.
- **CSV export doesn't escape spreadsheet formula prefixes** (`=`, `+`, `-`,
  `@`). Only matters if you export vocabulary and open it in Excel.
- **The scheduler has no cross-process lock.** Run one instance.

## If you think you've been exposed

1. Revoke the tokens: the GitLab PAT, Jira API token, Anthropic key, and
   regenerate any secret iCal URLs.
2. Rotate `COCKPIT_SECRET` and `COCKPIT_ACCESS_TOKEN`.
3. Bind to loopback, or put a token in front, before restarting.
