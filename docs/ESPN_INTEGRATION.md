# Golf Pool App - ESPN Integration

## Overview

The app integrates with ESPN's PGA scoreboard API for live scoring. The integration follows a two-phase handshake pattern.

## Two-Phase Integration

### Phase 1: Pre-Tournament (Admin)

Before the tournament starts, admins sync player names to ESPN IDs.

```
Admin Actions:
1. Bulk add players with odds
2. Trigger ESPN sync
3. Manual link any unmatched players
```

**Why?** Players and odds are entered before ESPN publishes the field, so we wire up ESPN athlete IDs separately.

#### Alternative: populate the roster straight from the ESPN field

Once ESPN has published the field, you can skip manual player entry and build the
roster from ESPN directly. Players are created with their ESPN athlete id already
linked (`espnMapped: true`) and **blank odds**; odds are layered on afterward.

```
Admin Actions (ESPN-first):
1. Create tournament with populatePlayers: true   → roster created + ESPN-linked
2. Import odds                                      → odds appended by name match
3. Manual link / manual odds for any stragglers
```

**Populate at create time** — `POST /tournaments` with `populatePlayers: true`
(requires `espnEventId`). Fetches the field via the path-style endpoint and
creates a player per competitor. If the ESPN fetch fails, the tournament is
still created and the response carries a `warning`.

```jsonc
// POST /tournaments
{ "name": "The Open", "espnEventId": "401811957",
  "startDate": "2026-07-16T04:00Z", "endDate": "2026-07-19T04:00Z",
  "populatePlayers": true }
// → { "id": "<tournamentId>", "playersCreated": 156 }
```

**Populate after the fact** — `POST /tournaments/:tournamentId/populate-espn-players`
(admin). Uses the tournament's stored `espnEventId`, or an `espnEventId` in the
body to override. Idempotent: players already linked by `espnId` are skipped, so
it can be re-run to pick up late field additions.

```typescript
POST /tournaments/:tournamentId/populate-espn-players
Body (optional): { espnEventId?: string }

Response: {
  created: number;
  skipped: number;                                 // already-linked players
  players: Array<{ id, name, espnId }>;
}
```

#### Appending odds to an existing roster

`POST /tournaments/:tournamentId/import-odds` fetches outright odds from
the-odds-api and **merges them onto existing players by name** (normalized name,
then a unique-last-name fallback). A matched player has its `odds` updated with
its ESPN link left intact; an unmatched odds entry creates a new player. This is
what lets the ESPN-first flow above end up with both ESPN ids *and* odds.

```typescript
POST /tournaments/:tournamentId/import-odds
Body: { sportKey: string, apiKey?: string }   // apiKey falls back to ODDS_API_KEY

Response: {
  playerCount: number;                          // total odds entries processed
  updated: number;                              // matched onto existing players
  created: number;                              // no match — new player created
  players: Array<{ id, name, odds, bookmakerCount, action: "updated" | "created" }>;
}
```

> **Caveat:** an odds entry whose name doesn't match an existing player (and whose
> last name isn't unique in the field) is created as a **duplicate** rather than
> merged. The `created` list surfaces exactly those for manual cleanup.

### Phase 2: Live Scoring (User)

During/after tournament, users view leaderboards.

```
User Actions:
1. View pool leaderboard
2. See live scores for all teams
3. Track counting vs non-counting picks
```

**When is ESPN called?** The leaderboard endpoint derives tournament status from `startDate`/`endDate` at request time. ESPN is only fetched when status is `active` or `completed` — it is skipped entirely for upcoming tournaments. ESPN's event state is no longer used to update Firestore.

## API Endpoint

```
GET https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard
GET https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event=<espnEventId>
GET https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard/<espnEventId>
```

The last (path-style) form returns the event object **directly**, without the
`events[]` wrapper the other two use. `services/espn.ts` parses both shapes, so
`fetchEventScoreboard()` (path form) and `fetchScoreboardForEvent()` (`?event=`)
are interchangeable for our purposes.

**Response Schema**: See `docs/schema-3-5.json`

## Key Response Fields

```typescript
interface EspnScoreboard {
  events: [
    {
      id: string; // ESPN event ID
      name: string; // Tournament name
      competitions: [
        {
          competitors: [
            // Player scores
            {
              id: string; // ESPN athlete ID
              athlete: {
                fullName: string;
                displayName: string;
              };
              score: string; // '-14', '+2', 'E', 'CUT', 'WD'
              status: string;
            },
          ];
        },
      ];
    },
  ];
}
```

## Name Matching Cascade

When syncing, we use a 4-level fuzzy matching cascade:

```typescript
function matchPlayers(ourPlayers: Player[], espnCompetitors: EspnCompetitor[]) {
  const unmatched: Player[] = [];

  for (const player of ourPlayers) {
    // 1. Exact match on fullName
    let match = espnCompetitors.find(c => c.athlete.fullName === player.name);

    // 2. Normalized match (lowercase, strip accents)
    if (!match) {
      const normalized = normalizeName(player.name);
      match = espnCompetitors.find(c =>
        normalizeName(c.athlete.fullName) === normalized
      );
    }

    // 3. Compacted match (strips dots, extra spaces)
    if (!match) {
      const compacted = compactName(player.name);
      match = espnCompetitors.find(c =>
        compactName(c.athlete.fullName) === compacted
      );
    }

    // 4. Last-name fallback (only if unique)
    if (!match) {
      const lastName = player.name.split(' ').pop();
      const lastNameMatches = espnCompetitors.filter(c =>
        c.athlete.fullName.endsWith(` ${lastName}`)
      );
      if (lastNameMatches.length === 1) {
        match = lastNameMatches[0];
      }
    }

    if (match) {
      // Update player.espnId and player.espnMapped = true
    } else {
      unmatched.push(player);
    }
  }

  return { matched: [...], unmatched };
}
```

### Name Normalization

```typescript
function normalizeName(name: string): string {
  // Strip NFD accents (é → e)
  // Lowercase
  // Trim whitespace
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function compactName(name: string): string {
  // Strip periods and extra spaces
  // 'J.J.' → 'JJ'
  return name.replace(/\./g, "").replace(/\s+/g, " ").trim();
}
```

## Local Development Fixture

When `FUNCTIONS_EMULATOR=true`, the app reads from `plan/sample_data.json` instead of hitting ESPN.

**Benefits**:

- Offline development
- Deterministic test data
- No rate limits

**Sample Data**: See `plan/sample_data.json` for recorded ESPN response.

## Sync Endpoint

```typescript
POST /tournaments/:tournamentId/sync-espn

Response: {
  matched: number;
  unmatched: number;
  matchedPlayers: Array<{ playerId, espnId, name }>;
  unmatchedPlayers: Array<{ id, name }>;
}
```

## Manual Linking

For players that fail auto-sync, admins can manually link:

```typescript
PUT /tournaments/players/:playerId/espn-link
Body: { espnId: "3448" }
```

## Leaderboard Scoring

```typescript
async function getLeaderboard(poolId: string) {
  const pool = await getPool(poolId);
  const tournament = await getTournament(pool.tournamentId);
  const teams = await getTeamsForPool(poolId);

  // Fetch ESPN scores
  const scoreboard = await fetchScoreboard(tournament.espnEventId);

  // Build score map by ESPN ID
  const scoreMap = new Map<string, number | null>();
  for (const competitor of scoreboard.competitors) {
    scoreMap.set(competitor.id, parseScore(competitor.score));
  }

  // Calculate each team's score
  for (const team of teams) {
    const players = await getPlayers(team.picks);
    const playerScores = players.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      score: scoreMap.get(p.espnId) ?? null,
      missedCut: scoreMap.get(p.espnId) === null,
    }));

    // Apply missed-cut penalty
    const adjustedScores = applyMissedCutPenalty(playerScores);

    // Calculate team total (best N of M)
    const { totalScore, counting } = calculateTeamScore(
      adjustedScores,
      pool.scoringRule,
    );

    leaderboard.push({ teamId: team.id, totalScore, counting });
  }

  return leaderboard.sort((a, b) => a.totalScore - b.totalScore);
}
```

## Error Handling

| ESPN Error          | Response | Recovery                |
| ------------------- | -------- | ----------------------- |
| Rate limited        | 502      | Retry with backoff      |
| Invalid event ID    | 404      | Check tournament config |
| No scores available | 200      | Return empty scores     |

## Caching

ESPN scores are not cached server-side (always fresh). Client-side TanStack Query handles caching with 30-second stale time.
