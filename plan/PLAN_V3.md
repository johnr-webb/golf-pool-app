# Golf Pool App — Backend Plan

## Context

Building the backend for a golf pool app where groups of friends create pools around PGA tournaments (primarily majors). Users pick golfers organized into odds-based tiers, and scores are pulled from ESPN's scoreboard API during the tournament. The app needs to handle the lifecycle: admin seeds players + odds, pool creator configures tiers/rules, users draft teams, and the leaderboard shows live scores once the tournament is underway.

Scrapping existing code — this is a fresh backend build.

## Tech Stack

- **Firebase Cloud Functions** (TypeScript) — serverless API endpoints
- **Firestore** — NoSQL document database
- **Firebase Auth** — user management (signup, login, password reset)

---

## Firestore Data Model

### `players` collection
Each document = one golfer for a specific tournament.
```
players/{playerId}  (auto-generated ID)
{
  name: string,              // "Scottie Scheffler"
  odds: string,              // "+600"
  tournamentId: string,      // references a tournament
  espnId: string | null,     // ESPN athlete ID, null until mapped
  espnMapped: boolean,       // false until Wednesday sync
  createdAt: timestamp
}
```

### `tournaments` collection
```
tournaments/{tournamentId}
{
  name: string,              // "The Masters 2026"
  espnEventId: string | null,// ESPN event ID from their calendar (e.g. "401811927")
  startDate: timestamp,
  endDate: timestamp,
  cutLine: number | null,    // score threshold for the cut, updated during tournament
  status: "upcoming" | "active" | "completed",
  createdAt: timestamp
}
```

### `pools` collection
```
pools/{poolId}
{
  name: string,
  password: string,          // hashed, for joining
  tournamentId: string,
  createdBy: string,         // user UID
  tiers: [                   // defined by pool creator
    {
      tierNumber: 1,
      oddsMin: string,       // e.g. "+400"
      oddsMax: string,       // e.g. "+800"
      picksRequired: 1       // how many players user must pick from this tier
    }
  ],
  scoringRule: {
    countBest: number,       // e.g. 4 (count best 4 scores)
    outOf: number            // e.g. 6 (out of 6 total picks)
  },
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### `teams` collection
```
teams/{teamId}
{
  name: string,
  userId: string,            // Firebase Auth UID
  poolId: string,
  picks: string[],           // array of player IDs
  createdAt: timestamp,
  updatedAt: timestamp
}
```

---

## API Endpoints (Cloud Functions)

### User routes (mostly handled by Firebase Auth SDK client-side)
- Firebase Auth handles `/create`, `/login`, `/resetPassword` on the client
- No custom Cloud Functions needed for basic auth

### Pool routes
- **POST `/pools`** — Create pool (auth required, admin scope check)
  - Body: `{ name, password, tournamentId, tiers, scoringRule }`
- **POST `/pools/:poolId/join`** — Join pool
  - Body: `{ password }`
  - Validates password, creates association
- **POST `/pools/:poolId/leave`** — Leave pool
  - Removes user's team from the pool
- **GET `/pools/:poolId/leaderboard`** — Get leaderboard
  - If tournament not started: return teams + picks
  - If tournament active/completed: fetch ESPN scores on-demand, calculate leaderboard

### Team routes
- **POST `/pools/:poolId/teams`** — Create team in a pool
  - Body: `{ name, picks: [playerIds] }`
  - Validates picks against pool tier rules
- **PUT `/teams/:teamId`** — Update team (full replace of picks)
  - Only before tournament starts
- **GET `/teams/:teamId`** — Get team with player details

### Player/Admin routes
- **POST `/tournaments`** — Create tournament
  - Body: `{ name, espnEventId, startDate, endDate }`
- **POST `/tournaments/:tournamentId/players`** — Bulk add players with odds
  - Body: `{ players: [{ name, odds }] }`
- **POST `/tournaments/:tournamentId/sync-espn`** — Trigger ESPN mapping
  - Fetches ESPN field, fuzzy matches names, maps ESPN IDs
  - Returns unmatched players for manual review
- **PUT `/players/:playerId/espn-link`** — Manually link a player to ESPN ID
  - Body: `{ espnId }`

---

## ESPN API Handshake

### The Problem
- Players + odds are entered manually before ESPN publishes the tournament field
- ESPN athlete IDs are needed to fetch live scores
- The field isn't finalized until ~Wednesday before the tournament (Thu-Sun)

### The Solution: Two-Phase Approach

**Phase 1: Pre-tournament mapping (Wednesday)**
1. Admin triggers `POST /tournaments/:tournamentId/sync-espn`
2. Function fetches `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard`
3. Parse competitors from the response — each has `id`, `athlete.fullName`, `athlete.displayName`
4. For each player in our `players` collection for this tournament:
   - Try exact match on `fullName`
   - Try normalized match (lowercase, strip accents, e.g. "Ludvig Aberg" matches "Ludvig Åberg")
   - Flag unmatched players — return them in the response for manual linking
5. Update matched players with `espnId` and `espnMapped: true`

**Phase 2: Live scoring (Thursday-Sunday)**
1. When `/pools/:poolId/leaderboard` is called:
   - Fetch ESPN scoreboard API
   - Extract score data for each competitor (overall `score` field like "-14")
   - Match to our players via stored `espnId`
   - Calculate leaderboard using pool's scoring rules

### ESPN Response Structure (from sample_data.json)
Key path: `events[0].competitions[0].competitors[]`
Each competitor has:
- `id`: ESPN athlete ID (e.g. "11378")
- `athlete.fullName`: "Robert MacIntyre"
- `score`: "-14" (overall score vs par)
- `linescores[]`: round-by-round and hole-by-hole detail
- `status`: can indicate if player made the cut

### Leaderboard Calculation
1. Fetch all teams in the pool
2. For each team, get their picked players' ESPN scores
3. Apply missed-cut penalty: any player who missed the cut gets assigned the worst score among players who made the cut
4. Apply `scoringRule`: take the best `countBest` scores out of `outOf` picks
5. Sum scores, rank teams lowest-to-highest

---

## File Structure
```
functions/
  src/
    index.ts                  # exports all Cloud Functions
    config/
      firebase.ts             # Firebase Admin init
    routes/
      pools.ts                # pool CRUD + leaderboard
      teams.ts                # team CRUD
      tournaments.ts          # tournament + player management
    services/
      espn.ts                 # ESPN API client + name matching
      leaderboard.ts          # scoring calculation logic
      validation.ts           # tier rule validation for picks
    types/
      index.ts                # shared TypeScript types
```

---

## Implementation Order

### Step 1: Project setup + data model
- Initialize Firebase project (reuse existing firebase.json config)
- Set up Cloud Functions with Express router
- Define TypeScript types for all collections

### Step 2: Tournament + Player management
- CRUD for tournaments
- Bulk player import (admin enters names + odds)
- Manual ESPN ID linking endpoint

### Step 3: ESPN integration
- ESPN scoreboard API client
- Name matching/normalization logic
- Sync endpoint that maps players to ESPN IDs

### Step 4: Pool management
- Create pool with tier configuration + scoring rules
- Join/leave pool with password
- Tier validation logic

### Step 5: Team management
- Create team with player picks
- Validate picks against tier rules
- Update team (pre-tournament only)

### Step 6: Leaderboard
- On-demand ESPN score fetching
- Missed-cut penalty logic
- Score aggregation with countBest/outOf rules
- Ranked leaderboard response

---

## Verification

1. **Unit tests** for:
   - ESPN name matching/normalization
   - Leaderboard scoring (missed cut penalty, best X of Y)
   - Tier validation (picks match tier requirements)

2. **Manual E2E test flow**:
   - Create tournament → bulk add players → create pool with tiers
   - Create user → create team with valid picks → verify tier validation rejects bad picks
   - Trigger ESPN sync → verify player mapping
   - Hit leaderboard endpoint → verify scores + ranking

3. **ESPN API verification**:
   - Hit `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard` directly
   - Confirm response shape matches our parsing logic against sample_data.json
