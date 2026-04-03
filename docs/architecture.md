# Architecture

## System Overview

The app is a client-rendered React SPA backed entirely by Firebase. There is no custom API server — the frontend talks directly to Firestore and Firebase Auth, and a single Cloud Function handles score fetching from an external API on a cached basis.

```mermaid
graph TD
    Browser["Browser (React SPA)"]
    Auth["Firebase Auth"]
    Firestore["Cloud Firestore"]
    Functions["Cloud Functions"]
    RapidAPI["RapidAPI\ngolf-leaderboard-data"]

    Browser -->|"login / signup"| Auth
    Browser -->|"read/write pools & members"| Firestore
    Browser -->|"fetchScores (callable)"| Functions
    Functions -->|"cache read/write"| Firestore
    Functions -->|"live scores"| RapidAPI
```

---

## Frontend

### Pages & Routing

All routes are protected except `/login` and `/signup`. Unauthenticated users are redirected to `/login`.

```
/                   → redirect to /dashboard
/login              → Login page
/signup             → Signup page
/dashboard          → Dashboard (pool summary + top picks preview)
/pools              → Pools list (create / join)
/pool/:poolId       → Pool detail (make picks + leaderboard)
```

```mermaid
flowchart LR
    Login --> Dashboard
    Signup --> Dashboard
    Dashboard --> Pools
    Pools -->|"create / join"| PoolDetail["PoolDetail\n/pool/:id"]
    PoolDetail -->|tab| MakePicks["Make Picks"]
    PoolDetail -->|tab| Leaderboard
```

### Component Tree

```
App
├── AuthProvider          (context: user, login, signup, logout)
└── BrowserRouter
    ├── /login            → Login
    ├── /signup           → Signup
    ├── /dashboard        → Dashboard
    │     └── usePools
    ├── /pools            → Pools
    │     └── usePools
    └── /pool/:poolId     → PoolDetail
          ├── usePool
          ├── useSelections
          ├── useScoring
          ├── useCopyToClipboard
          └── Leaderboard
```

### Hooks

| Hook                     | Responsibility                                  |
| ------------------------ | ----------------------------------------------- |
| `useAuth()`              | Reads auth state from `AuthContext`             |
| `usePools()`             | Fetch user's pools, create, join by code        |
| `usePool(poolId)`        | Fetch single pool + members + user's selections |
| `useSelections(poolId)`  | Save selections to Firestore                    |
| `useScoring(intervalMs)` | Poll `fetchScores` Cloud Function every 30s     |
| `useCopyToClipboard()`   | Copy invite code to clipboard with reset        |

---

## Backend

### Cloud Function: `fetchScores`

An HTTPS callable function. It:

1. Checks Firestore (`scores/{tournamentId}`) for a cached result ≤ 5 minutes old
2. Returns cache if fresh
3. Otherwise calls RapidAPI for live scores, writes result back to Firestore, returns fresh data

The client (via `useScoring`) calls this every 30 seconds. The 5-minute server-side cache ensures RapidAPI is called at most once per 5 minutes regardless of how many users are online.

```mermaid
sequenceDiagram
    participant Client
    participant fetchScores as Cloud Function
    participant Firestore
    participant RapidAPI

    Client->>fetchScores: call fetchScores({tournamentId})
    fetchScores->>Firestore: get scores/{tournamentId}
    alt cache is fresh (< 5 min)
        fetchScores-->>Client: return cached scores
    else cache stale or missing
        fetchScores->>RapidAPI: GET /tournament/{id}/leaderboard
        RapidAPI-->>fetchScores: player scores
        fetchScores->>Firestore: write updated scores
        fetchScores-->>Client: return fresh scores
    end
```

### Fallback Behavior

If `RAPIDAPI_KEY` is not set, `golfApi.ts` falls back to `generateMockData()` — randomly generated scores for the 22 seeded golfers. This allows full local development with no external dependencies.

---

## Data Flow: Making Picks

```mermaid
sequenceDiagram
    participant User
    participant PoolDetail
    participant Firestore

    User->>PoolDetail: selects golfer in each bucket
    PoolDetail->>PoolDetail: local state update (setSelections)
    User->>PoolDetail: clicks "Submit Selections"
    PoolDetail->>Firestore: saveSelections(poolId, userId, selections)
    Firestore-->>PoolDetail: write confirmed
    PoolDetail->>PoolDetail: setHasChanges(false)
```

Selections are blocked once the pool's `lockTime` has passed (`isLocked = new Date() > pool.lockTime`).

---

## Security

Firestore rules (`firestore.rules`):

| Collection           | Read   | Write                                                           |
| -------------------- | ------ | --------------------------------------------------------------- |
| `pools`              | Anyone | Authenticated users (create); owner only (update/delete)        |
| `pools/{id}/members` | Anyone | Authenticated users (create); member themselves (update/delete) |
| `scores`             | Anyone | Never (admin SDK only, via Cloud Function)                      |
