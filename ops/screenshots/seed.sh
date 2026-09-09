#!/usr/bin/env bash
# Seed the isolated screenshot server with one desk holding every widget and
# a little sample data. Usage: ./seed.sh [baseUrl]
set -euo pipefail
B="${1:-http://localhost:4100}"
J='content-type: application/json'
post() { curl -sS -X POST "$B$1" -H "$J" -d "$2"; echo; }

post /api/profiles '{"name":"Screenshots","kind":"personal","accent":"petrol","monogram":"SC"}'
for w in weather news todo recurring-tasks custom-api gitlab-open-mrs jira-my-issues google-calendar-today ai-assistant; do
  post /api/widgets "{\"profileId\":\"screenshots\",\"widgetId\":\"$w\",\"config\":{}}"
done
post /api/widgets '{"profileId":"screenshots","widgetId":"language-learning","config":{"language":"Spanish","nativeLanguage":"German","dailyGoalItems":10,"focusNote":""}}'
for t in "Book the dentist" "Renew the passport" "Send the invoice draft"; do
  post /api/todos "{\"profileId\":\"screenshots\",\"title\":\"$t\"}"
done
first=$(curl -sS "$B/api/todos?profileId=screenshots" | python3 -c 'import sys,json; print(json.load(sys.stdin)["todos"][0]["id"])')
curl -sS -X PATCH "$B/api/todos/$first" -H "$J" -d '{"done":true}'; echo
post /api/tasks '{"profileId":"screenshots","title":"Water the plants","cron":"0 9 * * 1,4"}'
post /api/tasks '{"profileId":"screenshots","title":"Backup check","cron":"0 9 * * 1"}'
