# Running cockpit as a macOS LaunchAgent

Keeps `next start` and the in-process scheduler running in the background.
[Docker](../../docs/self-hosting.md) is easier; this is for a native Mac setup.

```sh
# 1. Build once.
pnpm build

# 2. Fill in the template and install it.
sed -e "s|__COCKPIT_DIR__|$PWD|g" \
    -e "s|__PNPM_BIN__|$(command -v pnpm)|g" \
    -e "s|__PNPM_DIR__|$(dirname "$(command -v pnpm)")|g" \
    -e "s|__COCKPIT_SECRET__|$(openssl rand -base64 32)|g" \
    ops/launchd/cockpit.plist.template > ~/Library/LaunchAgents/cockpit.plist

# 3. The plist now holds the passphrase to data/credentials.enc, and `sed >`
#    creates it world-readable (0644) under the default umask.
chmod 600 ~/Library/LaunchAgents/cockpit.plist

# 4. Load it.
launchctl load ~/Library/LaunchAgents/cockpit.plist
```

### Keeping the secret out of the plist

`chmod 600` is enough on a single-user Mac, but the passphrase does not have to
live in the plist at all. Either of these leaves `COCKPIT_SECRET` out of it —
delete the key from the plist afterwards:

```sh
# Either: the macOS Keychain, and then no passphrase is needed at all.
#   Add <key>COCKPIT_KEYCHAIN</key><string>1</string> to EnvironmentVariables.

# Or: an env file Next reads itself. The agent runs `pnpm -C apps/web start`,
# so the server's working directory is apps/web and Next loads .env.local from
# there — verified by booting with COCKPIT_SECRET unset in the environment.
printf 'COCKPIT_SECRET=%s\n' "$(openssl rand -base64 32)" > apps/web/.env.local
chmod 600 apps/web/.env.local
```

`.env.local` is gitignored, and unlike the plist it never needs to be
regenerated when you change a launchd setting.

Then open <http://127.0.0.1:3000>. Logs land in `data/cockpit.{out,err}.log`.

Unload with `launchctl unload ~/Library/LaunchAgents/cockpit.plist`. After
changing the plist, unload and load again.

**Save the generated `COCKPIT_SECRET`.** It decrypts `data/credentials.enc`; if
you lose it you re-enter every widget connection. Back it up together with the
`data/` directory.

The template binds `127.0.0.1`, so only this Mac can reach cockpit. To serve
your LAN — a phone, a tablet — drop the `-H 127.0.0.1` arguments _and_ set
`COCKPIT_ACCESS_TOKEN`; cockpit has no other authentication. See
[SECURITY.md](../../SECURITY.md).
