# Self-hosting

cockpit is a single container with a single volume, or a single Node process on
your own machine. Pick one.

> **Read [SECURITY.md](../SECURITY.md) first.** cockpit has no user accounts. It
> is safe on `127.0.0.1`; anywhere else you need `COCKPIT_ACCESS_TOKEN`.

## Docker

```sh
git clone git@github.com:MarciD/Cockpit.git cockpit
cd cockpit
cp env.example .env
$EDITOR .env            # COCKPIT_SECRET is required
docker compose up -d --build
```

Then open <http://127.0.0.1:3000>. The first screen creates a desk.

The image is Debian-slim based (not Alpine) so `better-sqlite3` and `sharp`
resolve prebuilt binaries instead of compiling; expect ~1.2 GB, which is the
price of not fighting Next's file tracing. It builds for your host architecture,
arm64 included.

Schema migrations run automatically at every start, so upgrading is:

```sh
git pull && docker compose up -d --build
```

### Data and backups

Everything lives in the `cockpit-data` volume at `/data`:

| File              | What it is                                          |
| ----------------- | --------------------------------------------------- |
| `cockpit.sqlite`  | desks, widgets, layouts, to-dos, caches, vocabulary |
| `credentials.enc` | provider tokens, AES-256-GCM under `COCKPIT_SECRET` |

```sh
# back up
docker run --rm -v cockpit-data:/data -v "$PWD":/out debian:stable-slim \
  tar czf /out/cockpit-backup.tgz -C /data .
```

Back up `COCKPIT_SECRET` too — without it `credentials.enc` is unreadable and
every widget connection has to be entered again.

To use a host directory instead of a named volume, swap the volume line in
`compose.yaml` for `- ./data:/data` and make sure it is writable by uid 1000
(the image runs as the unprivileged `node` user).

### Run exactly one container

The scheduler runs in-process with no cross-process lock. Two replicas would
each fire every cron job against the same SQLite file. `compose.yaml` is written
for one; don't scale it.

### Timezone

Calendar rendering and the scheduler read the server's timezone. Set `TZ` in
`.env` or the container runs UTC and your day looks shifted.

## macOS, without Docker

```sh
pnpm install                       # Node ≥ 22, pnpm 11
pnpm build
COCKPIT_SECRET="$(openssl rand -base64 32)" pnpm -C apps/web start
```

To keep it running in the background — so the scheduler refreshes even with the
browser closed — install the LaunchAgent: see
[`ops/launchd/README.md`](../ops/launchd/README.md). On macOS you can also set
`COCKPIT_KEYCHAIN=1` and store credentials in the system Keychain, in which case
`COCKPIT_SECRET` isn't needed.

## Development

```sh
pnpm install
COCKPIT_SECRET=dev-only pnpm dev    # http://localhost:4000
```

Dev runs on **4000**; `next start` and the container run on 3000. Migrations
apply on boot, so there is no separate setup step. `pnpm --filter @cockpit/db
db:seed` optionally creates one demo desk with keyless widgets.

## Environment variables

| Variable                      |                 | Purpose                                                                                                                                                                     |
| ----------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `COCKPIT_SECRET`              | **required**    | Passphrase encrypting `credentials.enc`. cockpit won't boot without it. Rotating is free — old records are re-encrypted on read.                                            |
| `COCKPIT_ACCESS_TOKEN`        | recommended     | Shared token gating every request. Required in practice for any non-loopback access.                                                                                        |
| `TZ`                          | recommended     | Server timezone for calendars and the scheduler.                                                                                                                            |
| `COCKPIT_USER_NAME`           | optional        | Name used in the greeting and the assistant's prompt.                                                                                                                       |
| `COCKPIT_PORT`                | optional        | Host port to publish (container side is always 3000).                                                                                                                       |
| `COCKPIT_DB_PATH`             | optional        | SQLite path. Defaults to `../../data/cockpit.sqlite` relative to `apps/web`; the container sets `/data/cockpit.sqlite`.                                                     |
| `COCKPIT_CRED_FILE`           | optional        | Credential file path. Same defaulting.                                                                                                                                      |
| `COCKPIT_MIGRATIONS_DIR`      | optional        | Where the generated migrations live.                                                                                                                                        |
| `COCKPIT_ALLOW_PRIVATE_FETCH` | optional        | Allow server-side fetches of private/LAN addresses. Off by default so a crafted feed or calendar URL can't probe your network. Turn on only if your own feeds are internal. |
| `COCKPIT_KEYCHAIN`            | optional, macOS | Use the system Keychain instead of the encrypted file.                                                                                                                      |

## Behind a reverse proxy

Terminate TLS at the proxy and forward to cockpit. Two things matter:

- Pass `X-Forwarded-Host`, or the same-origin check will reject your requests —
  it compares the browser's `Origin` against the host cockpit was addressed on.
- Set `COCKPIT_ACCESS_TOKEN`, or put the proxy's own authentication in front.
  Publishing cockpit unauthenticated exposes every stored integration to anyone
  who can reach it.

Cookies are marked `Secure` only when the request itself arrives over HTTPS, so
a plain-HTTP LAN setup still works.

## Troubleshooting

**`COCKPIT_SECRET is not set`** — expected: set it and restart.

**"could not decrypt credential … is COCKPIT_SECRET the value it was saved
with?"** — the secret changed and the record wasn't written by an older cockpit
either. Restore the old secret, or reconnect the affected widgets.

**A widget shows "showing cached data"** — the provider call failed but the
cache still had a good payload. Check `docker compose logs`.

**A widget asks you to reconnect** — the provider rejected the stored token; its
own explanation is on the card.

**A feed or calendar URL is refused** — the URL points at a private or loopback
address. Intentional; see `COCKPIT_ALLOW_PRIVATE_FETCH`.

**Health check**: `curl localhost:3000/api/health` → `{"ok":true,"desks":N}`. It
is reachable without the access token and reports nothing sensitive.
