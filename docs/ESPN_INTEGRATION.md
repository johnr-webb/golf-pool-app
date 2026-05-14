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
```

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
