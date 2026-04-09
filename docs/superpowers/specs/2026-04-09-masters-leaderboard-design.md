# Masters-Enhanced Leaderboard — Design Spec

## Context

The golf pool app has a functional leaderboard that shows team standings with player scores. For the 2026 Masters tournament, we want to create a premium, Masters-specific leaderboard experience that layers rich data from masters.com APIs on top of the existing pool scoring. The goal: when your friends pull up the pool during Masters week on their phones, it feels like a proper Masters experience — dark theme, Augusta green and gold, country flags, hole-by-hole scorecards, tournament ticker.

The Masters code should be modular — a separate set of components and services that swap in for the existing leaderboard when a tournament is flagged as the Masters, without removing or modifying the existing leaderboard components.

## Data Sources

### Masters.com Public APIs (new)
- **Players:** `https://www.masters.com/en_US/cms/feeds/players/{year}/players.json`
  - 91 players: name, countryCode, countryName, age, height, weight, swing, past_champion, amateur, first_masters, id
- **Scores:** `https://www.masters.com/en_US/scores/feeds/{year}/scores.json`
  - Live data: position, today score, thru, tee time, movement, hole progress
  - Per-round: 18-element `scores` array (hole-by-hole), round total, round status
  - Pars and yardages per round
  - Status flags: active, wd, dq, cut
- **Holes:** `https://www.masters.com/en_US/json/man/course/angc/holes.json`
  - 18 holes: number, plant name, par, yardage, description, insights (fairway/approach/green), historical stats (eagles/birdies/pars/bogeys), images, player quotes

### Existing Backend (unchanged)
- **Pool leaderboard:** `GET /pools/:poolId/leaderboard`
  - Team rankings with pool scoring rules (best N of M, missed-cut penalty)
  - PlayerScore: playerId, playerName, score, missedCut, counting

## Architecture

### Detection
Tournament documents gain an optional `mastersYear` field (e.g., `"2026"`). Set by an admin when creating the tournament (or by directly editing the Firestore doc). When set, the leaderboard response includes it, signaling the frontend to render the Masters experience. Tournaments without this field render the existing leaderboard unchanged.

### Dark Theme
The Masters components apply their own dark styling with specific colors (see UI Design section). This works with the app's existing Mantine dark color scheme — the Masters components just use more specific inline styles / CSS module overrides for the premium Augusta look.

### Backend Changes

**New file: `functions/src/services/masters.ts`**
- `fetchMastersScores(year: string)` — fetch + cache scores.json (30s TTL in-memory)
- `fetchMastersPlayers(year: string)` — fetch + cache players.json (1hr TTL, static data)
- `fetchMastersHoles()` — fetch + cache holes.json (1hr TTL, static data)
- All fetches include `User-Agent` header (required by masters.com)
- `buildMastersLeaderboard(...)` — joins pool teams/picks with Masters data, returns enriched response

**Modified: `functions/src/routes/pools.ts`**
- When tournament has `mastersYear`, the leaderboard endpoint fetches from masters.com instead of ESPN
- Returns an enriched `MastersLeaderboardResponse` with:
  - `mastersYear` flag
  - `leaders[]` — top 10 tournament leaders (pos, flag, name, score, thru) for the ticker
  - `currentRound` — which round is active
  - `roundPars` — par for each hole (from scores.json)
  - Enriched `playerScores[]` with: country code, hole-by-hole scores per round, position, today score, thru, current hole, bio (age, height, past champion, amateur, first Masters)
  - `holes[]` — 18 holes with plant name, par, yardage (for "Hole 13 · Azalea, Par 5" display)
- Non-Masters tournaments continue using ESPN path unchanged

No new routes or router needed — the existing leaderboard endpoint handles both paths.

### Frontend Changes

**New directory: `web/lib/masters/`**
- `types.ts` — TypeScript types for the enriched Masters leaderboard response
- `flags.ts` — `countryCodeToFlag(code)` using regional indicator symbol pairs (e.g., "USA" → "🇺🇸")

No separate hooks needed — the existing `getLeaderboard(poolId)` call returns Masters-enriched data when applicable. The frontend just renders differently based on response shape.

**New directory: `web/components/masters/`**
- `MastersHero.tsx` — Green gradient banner with tournament name, round, your team rank, field size, cut line
- `MastersTicker.tsx` — Horizontal scrolling tournament leaders strip with pos/flag/name/score/thru chips
- `MastersTeamCard.tsx` — Dark card with gold/silver/bronze rank badge, team name, total score. Expands to show player rows.
- `MastersPlayerRow.tsx` — Collapsed: flag, name, current hole + hole name, today/total. Expandable.
- `MastersScorecard.tsx` — Inline-expanding scorecard: player bio header (flag, name, age, height, past champion badge), stats bar (pos/total/today/thru), round tabs (R1-R4), front 9 + back 9 grid with color-coded score cells
- `MastersScorecardCell.tsx` — Individual score cell: birdie = green circle, bogey = red square, eagle = gold circle with glow, double bogey+ = dark red square, par = plain
- `MastersLeaderboard.tsx` — Orchestrator: fetches pool leaderboard + Masters data, merges them, renders Hero → Ticker → Team cards. This replaces `LeaderboardActive` when mastersYear is present.

**Modified: `web/components/leaderboard/Leaderboard.tsx`**
- When leaderboard response includes `mastersYear`, render `MastersLeaderboard` instead of `LeaderboardActive`
- Existing `LeaderboardActive` component stays completely untouched

**Modified: `web/lib/types/api.ts`**
- Add `mastersYear?: string` to `LeaderboardResponse` active/completed variant

### Prod Backend Switch

**New file: `web/.env.prod`**
- Points `INTERNAL_API_URL` to the deployed Cloud Function URL
- Sets `NEXT_PUBLIC_USE_EMULATORS=false`
- Placeholder for real Firebase API key and App ID (get via `firebase apps:sdkconfig web`)
- Usage: `cp .env.prod .env.local && npm run dev`

## UI Design

### Theme
- Dark background: `#141414` page, `#1e1e1e` cards
- Masters green: `#0a3d0a` (hero, expanded player headers, accents)
- Masters gold: `#d4af37` (rank badges, champion badge, eagle glow, labels)
- Score green: `#4ade80` (under-par scores)
- Score red: `#dc2626` (bogey+ cells)
- Muted text: `#888` / `#666` / `#555` on dark surfaces

### Page Structure (top to bottom)
1. **Hero Banner** — Full-width Masters green gradient. "Augusta National Golf Club" in gold caps, "The Masters" large, "Round N · Date". Quick stats: your team rank, field size, cut line.
2. **Tournament Leaders Ticker** — Dark green strip (`#0d2e0d`). Gold "Leaders" badge, then horizontal-scrolling pill chips: position (gold/silver/bronze/gray), flag emoji, last name, score, thru/F.
3. **Pool Standings** — Section header "Pool Standings" + green Live badge. Team cards stacked vertically.

### Team Card
- Dark card (`#1e1e1e`), left border color by rank (gold 1st, silver 2nd, bronze 3rd, gray 4+)
- Header: rank circle badge, team name, total score
- Tap to expand: shows player rows

### Player Row (collapsed)
- Flag emoji, display name, current hole number + hole name in green ("Hole 13 · Azalea, Par 5"), total score, today score, expand chevron

### Player Row (expanded) — Scorecard
- Green gradient header: large flag, full name, bio line (age · height · champion/amateur/first Masters badges), large total score, position + today
- Round pill tabs: R1 (active, green pill) / R2 / R3 / R4
- Front 9 table: hole numbers row, score row with color-coded cells, OUT total
- Back 9 table: hole numbers row, score row with color-coded cells, IN total
- Unplayed holes shown as dim dots (·)
- Legend: Eagle (gold circle) / Birdie (green circle) / Bogey+ (red square)

### Score Cell Color Coding
| Score vs Par | Shape | Color | Extra |
|---|---|---|---|
| Eagle or better (-2+) | Circle | `#d4af37` gold | Subtle glow shadow |
| Birdie (-1) | Circle | `#22c55e` green | — |
| Par (0) | Plain text | `#ddd` | No decoration |
| Bogey (+1) | Square (border-radius: 4px) | `#dc2626` red | — |
| Double bogey+ (+2+) | Square | `#991b1b` dark red | — |

## Data Flow

```
Single endpoint, two paths:

Non-Masters:
  GET /pools/:poolId/leaderboard
    → backend fetches ESPN → returns existing LeaderboardResponse

Masters:
  GET /pools/:poolId/leaderboard
    → backend detects mastersYear on tournament doc
    → fetches masters.com scores + players + holes (with caching)
    → joins with pool teams/picks
    → returns MastersLeaderboardResponse (enriched superset)

Frontend:
  response has mastersYear? → render MastersLeaderboard
  otherwise → render LeaderboardActive (existing, untouched)
```

Polling: Same 30s interval as today. Backend caches masters.com responses with 30s TTL so concurrent requests don't hammer the API. Players and holes cached for 1hr (static data).

## Scope Boundaries

### In Scope
- Masters hero, ticker, team cards, player rows, inline scorecard
- Score cell color coding (eagle/birdie/par/bogey/double)
- Player bio badges (past champion, amateur, first Masters)
- Country flag emojis
- Current hole + hole name display
- Round tabs (R1-R4)
- Prod backend switch (.env.prod)

### Out of Scope
- Hole detail popovers (tapping a hole number to see description/image) — future enhancement
- Course guide page/tab
- Animated ticker auto-scroll
- Push notifications for score changes
- Hole images in the scorecard

## Verification

1. **Backend**: Start emulators, create a tournament with `mastersYear: "2026"`, hit `GET /masters/2026/scores` and verify it returns structured data. Hit leaderboard endpoint and verify `mastersYear` field is present.
2. **Frontend**: Run `npm run dev`, navigate to a pool with a Masters tournament. Verify hero banner renders with round info. Verify ticker shows tournament leaders with flags. Expand a team card and verify player rows show flag, hole, today/total. Expand a player and verify scorecard shows hole-by-hole with correct color coding. Verify round tabs switch correctly.
3. **Typecheck**: `cd web && npm run typecheck` passes.
4. **Mobile**: Check on a 375px viewport — all elements readable, scorecard scrollable horizontally if needed, no overflow issues.
5. **Non-Masters**: Navigate to a pool with a non-Masters tournament and verify the existing `LeaderboardActive` renders unchanged.
