#!/usr/bin/env bash
#
# Import "The Open" into a new tournament, ESPN-first.
#
# Flow (all existing routes in functions/src/routes/tournaments.ts):
#   1. POST /tournaments  (populatePlayers: true)
#        → creates the tournament AND its player roster straight from the ESPN
#          field, with each player's ESPN athlete id already linked. Odds blank.
#   2. POST /tournaments/:id/import-odds
#        → pulls odds from the-odds-api and APPENDS them onto the players created
#          in step 1 (matched by name). Unmatched odds entries create new players.
#
# Event metadata (name, espnEventId, dates) comes from data/the_open_roster.json.
# The roster's espnEventId is what step 1 uses to fetch the field from ESPN.
#
# Requirements: bash, curl, jq.
#
# Usage:
#   API_BASE=... ADMIN_TOKEN=... ODDS_API_KEY=... ./scripts/import-the-open.sh
#
# Env vars:
#   API_BASE       API root. Local emulator:
#                    http://127.0.0.1:5001/golf-pool-app-492300/us-central1/api
#                  Prod: your deployed functions URL ending in /api
#   ADMIN_TOKEN    Firebase ID token for an admin user (Bearer token).
#   ODDS_API_KEY   the-odds-api key (or set it server-side and drop it here).
#   SPORT_KEY      the-odds-api sport key. Defaults to golf_the_open_championship_winner.

set -euo pipefail

ROSTER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/data/the_open_roster.json"
SPORT_KEY="${SPORT_KEY:-golf_the_open_championship_winner}"

: "${API_BASE:?set API_BASE to the /api root}"
: "${ADMIN_TOKEN:?set ADMIN_TOKEN to an admin Firebase ID token}"
: "${ODDS_API_KEY:?set ODDS_API_KEY to a the-odds-api key}"

for bin in curl jq; do
  command -v "$bin" >/dev/null || { echo "error: $bin is required" >&2; exit 1; }
done
[ -f "$ROSTER" ] || { echo "error: roster file not found at $ROSTER" >&2; exit 1; }

NAME=$(jq -r '.name' "$ROSTER")
ESPN_EVENT_ID=$(jq -r '.espnEventId' "$ROSTER")
START_DATE=$(jq -r '.startDate' "$ROSTER")
END_DATE=$(jq -r '.endDate' "$ROSTER")

echo "==> Creating tournament + populating players from ESPN"
echo "    $NAME (espnEventId=$ESPN_EVENT_ID)"
CREATE_BODY=$(jq -n \
  --arg name "$NAME" \
  --arg espnEventId "$ESPN_EVENT_ID" \
  --arg startDate "$START_DATE" \
  --arg endDate "$END_DATE" \
  '{name:$name, espnEventId:$espnEventId, startDate:$startDate, endDate:$endDate, populatePlayers:true}')

CREATE_RES=$(curl -fsS -X POST "$API_BASE/tournaments" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CREATE_BODY")
echo "$CREATE_RES" | jq '{id, playersCreated, warning}'

TOURNAMENT_ID=$(echo "$CREATE_RES" | jq -r '.id')
[ "$TOURNAMENT_ID" != "null" ] || { echo "error: no tournament id returned" >&2; exit 1; }
echo "    tournamentId=$TOURNAMENT_ID"

# If create-time population failed (warning present), retry via the standalone route.
if [ "$(echo "$CREATE_RES" | jq -r '.playersCreated // 0')" = "0" ]; then
  echo "==> No players created at create time — retrying populate-espn-players"
  curl -fsS -X POST "$API_BASE/tournaments/$TOURNAMENT_ID/populate-espn-players" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    | jq '{created, skipped}'
fi

echo "==> Appending odds from the-odds-api (sportKey=$SPORT_KEY)"
curl -fsS -X POST "$API_BASE/tournaments/$TOURNAMENT_ID/import-odds" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg sportKey "$SPORT_KEY" --arg apiKey "$ODDS_API_KEY" '{sportKey:$sportKey, apiKey:$apiKey}')" \
  | jq '{playerCount, updated, created, createdPlayers: [.players[] | select(.action=="created") | .name]}'

echo "==> Done."
echo "    'updated' = odds merged onto ESPN-populated players."
echo "    'created' = odds names that did NOT match the field (review these as possible duplicates)."
echo "    ESPN ids for every player are in $ROSTER."
