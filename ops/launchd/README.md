# Running cockpit as a macOS LaunchAgent

Keeps `next start` and the in-process scheduler running in the background, and
brings them back after every login or reboot.
[Docker](../../docs/self-hosting.md) is easier; this is for a native Mac setup.

The agent runs [`Cockpit`](Cockpit), a small launcher that serves its own
production build from `apps/web/.next-service` and builds it first when it is
missing. So there is no separate build step, and macOS lists the agent as
"Cockpit" under System Settings → General → Login Items.

```sh
# 1. Fill in the template and install it.
sed -e "s|__COCKPIT_DIR__|$PWD|g" \
    -e "s|__NODE_DIR__|$(dirname "$(command -v node)")|g" \
    -e "s|__COCKPIT_SECRET__|$(openssl rand -base64 32)|g" \
    ops/launchd/cockpit.plist.template > ~/Library/LaunchAgents/cockpit.plist

# 2. The plist now holds the passphrase to data/credentials.enc, and `sed >`
#    creates it world-readable (0644) under the default umask.
chmod 600 ~/Library/LaunchAgents/cockpit.plist

# 3. Load it. The first start builds, so give it a minute or two.
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/cockpit.plist
```

### Keeping the secret out of the plist

`chmod 600` is enough on a single-user Mac, but the passphrase does not have to
live in the plist at all. Either of these leaves `COCKPIT_SECRET` out of it —
delete the key from the plist afterwards:

```sh
# Either: the macOS Keychain, and then no passphrase is needed at all.
#   Add <key>COCKPIT_KEYCHAIN</key><string>1</string> to EnvironmentVariables.

# Or: an env file Next reads itself. The launcher runs `next start` from
# apps/web, so Next loads .env.local from there — verified by booting with
# COCKPIT_SECRET unset in the environment.
printf 'COCKPIT_SECRET=%s\n' "$(openssl rand -base64 32)" > apps/web/.env.local
chmod 600 apps/web/.env.local
```

`.env.local` is gitignored, and unlike the plist it never needs to be
regenerated when you change a launchd setting.

Then open <http://127.0.0.1:3000>. Logs land in `data/cockpit.{out,err}.log`.

Unload with `launchctl bootout gui/$(id -u)/cockpit`. After changing the
plist, unload and load again.

**Save the generated `COCKPIT_SECRET`.** It decrypts `data/credentials.enc`; if
you lose it you re-enter every widget connection. Back it up together with the
`data/` directory.

The template binds `127.0.0.1`, so only this Mac can reach cockpit. To serve
your LAN — a phone, a tablet — drop the `-H 127.0.0.1` arguments _and_ set
`COCKPIT_ACCESS_TOKEN`; cockpit has no other authentication. See
[SECURITY.md](../../SECURITY.md).

### Updating

The agent keeps serving the build it made, so pulled changes need a rebuild.
It serves whatever branch is checked out, so switch to `main` first.

```sh
rm -rf apps/web/.next-service
launchctl kickstart -k gui/$(id -u)/cockpit   # rebuilds, then starts
```

### Why its own build folder

`next dev`, `next build` and `rm -rf apps/web/.next` all write or delete
`apps/web/.next`. When the agent served from there, deleting that folder left
it running without its JavaScript: every page still rendered, but nothing
hydrated. On a gated install that meant `/login` showed the token field and an
Unlock button that could never be pressed. The symptom is chunk requests under
`/_next/static/` failing while the HTML loads fine. With `.next-service`, dev
work and the agent no longer share anything.

`next build` also points `next-env.d.ts` and `tsconfig.json` at the folder it
built into. The launcher puts both back afterwards, so a service build never
shows up in `git status`.

### Running `pnpm dev` alongside it

Dev runs on 4000. If you set the agent to 4000 as well, the two cannot run at
once: stop the agent with `launchctl bootout` before `pnpm dev`, and bootstrap
it again afterwards.
