# Golf Pool App - Firestore Data Model

## Collections Overview

| Collection    | Purpose             | Key Fields                          |
| ------------- | ------------------- | ----------------------------------- |
| `users`       | User profiles       | email, displayName, realName, admin |
| `tournaments` | PGA tournaments     | name, dates, status, espnEventId    |
| `players`     | Tournament field    | name, odds, espnId, tournamentId    |
| `pools`       | Pool configurations | name, password, tiers, scoringRule  |
| `teams`       | User picks          | userId, poolId, picks[]             |

---

## users/{uid}

Firebase Auth UID as document ID.

```typescript
interface User {
  email: string;
  displayName: string; // Public nickname shown on leaderboards
  realName: string; // Legal name for admin records
  admin: boolean; // Admin flag (promote by setting true)
  createdAt: Timestamp;
}
```

**Indexes**: None required (document by ID).

**Security**: Users can only read/write their own document.

---

## tournaments/{tournamentId}

PGA tournament events.

```typescript
interface Tournament {
  name: string; // "The Masters 2026"
  espnEventId: string | null; // ESPN event ID for score syncing
  startDate: Timestamp;
  endDate: Timestamp;
  cutLine: number | null; // Score that defined cut (e.g., +1)
  mastersYear?: string; // For Masters-specific features (e.g., "2026")
  createdAt: Timestamp;
}
```

**Note**: Tournament status (`upcoming` / `active` / `completed`) is **not stored** in Firestore. It is derived at request time from `startDate` and `endDate`. This keeps status always fresh without any Firestore writes.

**Indexes**:

- `startDate` (ascending) - for sorting

---

## players/{playerId}

Golfers in a tournament field.

```typescript
interface Player {
  name: string; // Full display name (e.g., "Scottie Scheffler")
  normalizedName?: string; // Lowercase, accent-stripped (computed)
  odds: string; // Odds as string "+600" (preserves format)
  tournamentId: string; // Parent tournament reference
  espnId: string | null; // ESPN athlete ID for score lookup
  espnMapped: boolean; // True if linked to ESPN
  createdAt: Timestamp;
}
```

**Indexes**:

- `tournamentId` (ascending) - for listing players in a tournament
- `tournamentId, odds` (ascending, ascending) - for tier grouping

**Computed Fields** (on write):

- `normalizedName`: `normalizeName(name)` - NFD strip, lowercase, trim

---

## pools/{poolId}

Pool configurations with tier and scoring rules.

```typescript
interface TierConfig {
  tierNumber: number; // 1-indexed tier number
  oddsMin: string; // Minimum odds (e.g., "+100")
  oddsMax: string; // Maximum odds (e.g., "+500")
  picksRequired: number; // Number of picks required from this tier
}

interface ScoringRule {
  countBest: number; // Count best N scores (e.g., 4)
  outOf: number; // Out of total picks (e.g., 6)
}

interface Pool {
  name: string; // "Friends League 2026"
  password: string; // Plain text (no hashing)
  tournamentId: string; // Parent tournament reference
  createdBy: string; // User UID of pool creator
  tiers: TierConfig[]; // Ordered tier definitions
  scoringRule: ScoringRule;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Indexes**:

- `tournamentId` (ascending) - for listing pools in a tournament
- `createdBy` (ascending) - for user's created pools

**Tier Example**:

```javascript
// 6 picks: 2 from each tier
tiers: [
  { tierNumber: 1, oddsMin: '+100', oddsMax: '+500', picksRequired: 2 },
  { tierNumber: 2, oddsMin: '+501', oddsMax: '+2000', picksRequired: 2 },
  { tierNumber: 3, oddsMin: '+2001', oddsMax: '+9999', picksRequired: 2 }
]
// Count best 4 of 6 picks
scoringRule: { countBest: 4, outOf: 6 }
```

---

## teams/{teamId}

User's picks for a pool.

```typescript
interface Team {
  name: string; // "Team Eagle" (user-chosen)
  userId: string; // Owner's Firebase UID
  poolId: string; // Parent pool reference
  picks: string[]; // Array of player document IDs
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Indexes**:

- `poolId, userId` (ascending, ascending) - unique per user per pool
- `userId` (ascending) - for user's teams
- `poolId` (ascending) - for pool members

**Constraints**:

- One team per user per pool (enforced at application level)
- Picks can only be modified before the tournament `startDate`

---

## Relationships

```
users/{uid}
    └── (references via createdBy, userId)

tournaments/{tournamentId}
    ├── players/{playerId} (tournamentId reference)
    └── pools/{poolId} (tournamentId reference)

pools/{poolId}
    ├── tournaments/{tournamentId} (tournamentId reference)
    └── teams/{teamId} (poolId reference)

teams/{teamId}
    ├── pools/{poolId} (poolId reference)
    ├── users/{uid} (userId reference)
    └── players/{playerId} (picks[] references)
```

---

## Data Flow

### Creating a Tournament (Admin)

1. Admin calls `POST /tournaments`
2. Creates tournament document
3. Admin bulk-adds players via `POST /tournaments/:id/players`
4. Admin triggers `POST /tournaments/:id/sync-espn`
5. Players matched to ESPN IDs

### Joining a Pool

1. User calls `POST /pools/:id/join` with password
2. Password validated server-side
3. User creates team via `POST /teams/pools/:id/teams`
4. Picks validated against tier rules

### Live Scoring

1. User calls `GET /pools/:id/leaderboard`
2. Server fetches ESPN scoreboard
3. Matches picks by `espnId`
4. Calculates scores with missed-cut penalty
5. Returns ranked leaderboard

---

## Security Rules (firestore.rules)

See `firestore.rules` for complete security rules. Key rules:

- Users can only read/write their own `users/{uid}` document
- Anyone authenticated can read tournaments and pools
- Only pool creator can modify pool settings
- Only team owner can modify their team
- Players can only be added/modified by admins
