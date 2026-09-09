# Widget screenshots

Produces the `screenshots/*.png` every widget README embeds: `tile.png`
(the card at 2×), `settings.png` (the configure modal, only for widgets with
settings) and `page.png` (a widget's full page, 1×). Everything runs against
an **isolated** dev server with a scratch database and credential file, so no
personal data ends up in the repo and the launchd `next start` on port 4000
is never touched.

```bash
# 1. isolated server (scratch db + creds, no access token, own dist dir)
S=/tmp/cockpit-shots && mkdir -p "$S"
cd apps/web && COCKPIT_DIST_DIR=.next-shots COCKPIT_DB_PATH="$S/cockpit.sqlite" \
  COCKPIT_CRED_FILE="$S/credentials.enc" COCKPIT_SECRET="shots-$(openssl rand -hex 12)" \
  COCKPIT_ACCESS_TOKEN= TZ=Europe/Berlin node_modules/.bin/next dev -p 4100

# 2. one desk with every widget and a little sample data
ops/screenshots/seed.sh

# 3. capture (this folder has its own package.json, outside the workspace)
cd ops/screenshots && npm install && npx playwright install chromium
npm run capture                     # writes out/<widget>/{tile,settings,page}.png

# 4. copy into the widget folders, drop settings.png for widgets without settings
for w in out/*; do cp "$w"/*.png "../../packages/widgets/src/$(basename "$w")/screenshots/"; done
```

Keep each PNG under 300 KB (full pages are captured at 1× for that reason).
Retake a widget's screenshots whenever its look changes.
