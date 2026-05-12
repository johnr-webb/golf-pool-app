# Golf Pool App - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (web/)                          │
│                     Next.js 15 + React 19                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │Auth Pages│  │Pool Pages│  │Team Pages│  │Leaderboard     │  │
│  │/login    │  │/pools    │  │/team/new │  │/pools/:id      │  │
│  │/signup   │  │/pools/:id│  │/team/edit│  │(Masters/ESPN)  │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │
│                          │                                       │
│              ┌───────────┴───────────┐                          │
│              │    API Client Layer   │                          │
│              │  web/lib/api/client.ts│                          │
│              │  (Firebase Auth only) │                          │
│              └───────────┬───────────┘                          │
└──────────────────────────┼───────────────────────────────────────┘
                           │ HTTP + __session cookie
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (functions/)                          │
│               Firebase Cloud Functions + Express                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    Express Router                          │  │
│  │  /tournaments/*  /pools/*  /teams/*  /users/*  /session/* │  │
│  └────────────────────────────────────────────────────────────┘  │
│                          │                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────────┐  │
│  │ Auth Middle │  │ Services    │  │ External Integrations  │  │
│  │ requireAuth │  │ leaderboard │  │ ESPN API               │  │
│  │ requireAdmin│  │ validation  │  │ Masters.com API        │  │
│  └─────────────┘  │ espn        │  │ the-odds-api.com       │  │
│                   │ masters      │  └────────────────────────┘  │
│                   │ odds         │                              │
│                   └─────────────┘                              │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │     Firestore DB       │
              │  users / tournaments   │
              │  players / pools / teams│
              └────────────────────────┘
```

## Key Architectural Decisions

### 1. Single Cloud Function Export

All backend routes are mounted on one Express app exported as a single Cloud Function:

```typescript
export const api = functions.https.onRequest(app);
```

This allows all routes to share middleware and simplifies Firebase deployment.

### 2. No Firestore SDK from Frontend

The Firebase client SDK is scoped to **authentication only**. All data access flows through the Express API:

```typescript
// web/lib/api/client.ts - ONLY data access mechanism
import { getAuth } from "firebase/auth";
import { apiFetch } from "./client";

export async function getPools() {
  const token = await getAuth().currentUser.getIdToken();
  return apiFetch("/pools/mine", { token });
}
```

### 3. Session Cookie for SSR

Next.js server components authenticate via `__session` cookie (5-day lifetime):

- Client signs in → gets Firebase ID token
- Client calls `POST /session` → exchanges ID token for session cookie
- Cookie sent with all SSR requests
- Backend `requireAuth` checks both Bearer token AND cookie

### 4. Admin Flag in Firestore

Admin status lives in `users/{uid}.admin` (Firestore), not Firebase custom claims. This allows easy promotion without token refresh:

```typescript
// middleware/auth.ts
const userDoc = await db.collection("users").doc(uid).get();
req.admin = userDoc.get("admin") ?? false;
```

### 5. ESPN Integration - Two-Phase Handshake

1. **Pre-tournament**: Admin syncs → fuzzy match players to ESPN IDs
2. **Live scoring**: Leaderboard joins picks by `espnId`

### 6. Tournament Status is Date-Derived

There is no `status` field in the `tournaments` Firestore collection. Status is computed from `startDate`/`endDate` at the point of use:

- **Backend leaderboard**: derives status inline to decide whether to call ESPN (skipped when upcoming)
- **Frontend**: `statusFromDates(startDate, endDate)` in `web/lib/utils/format.ts`, called at render time in components

## Directory Structure

```
golf-pool-app/
├── functions/              # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts       # Express app entry point
│   │   ├── routes/        # Route handlers
│   │   │   ├── tournaments.ts
│   │   │   ├── pools.ts
│   │   │   ├── teams.ts
│   │   │   ├── users.ts
│   │   │   ├── session.ts
│   │   │   └── dev.ts      # Emulator-only endpoints
│   │   ├── services/      # Business logic
│   │   │   ├── espn.ts
│   │   │   ├── leaderboard.ts
│   │   │   ├── validation.ts
│   │   │   ├── odds.ts
│   │   │   └── masters.ts
│   │   ├── middleware/     # Express middleware
│   │   │   └── auth.ts
│   │   ├── types/          # TypeScript types
│   │   │   └── index.ts
│   │   └── utils/          # Utilities
│   │       ├── teamSerializers.ts
│   │       └── logging.ts
│   └── package.json
│
├── web/                    # Next.js frontend
│   ├── app/
│   │   ├── (auth)/         # Auth pages (unauthenticated)
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (app)/          # App pages (authenticated)
│   │   │   └── pools/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── auth/
│   │   ├── pools/
│   │   ├── leaderboard/
│   │   ├── teams/
│   │   ├── masters/        # Masters-specific UI
│   │   └── common/
│   ├── lib/
│   │   ├── api/            # API client modules
│   │   ├── firebase/       # Firebase config (auth only)
│   │   ├── masters/        # Masters scoring (client-side)
│   │   ├── query/          # TanStack Query setup
│   │   └── validation/     # Client-side validation
│   └── middleware.ts       # Edge middleware for auth
│
├── docs/                   # Documentation
├── plan/                   # Design documents
├── scripts/                # Dev scripts
└── firebase.json          # Firebase config
```

## Environment Configuration

### Frontend (.env.local)

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_USE_EMULATOR=false
```

### Backend (Secret Manager / .env)

```
THE_ODDS_API_KEY=           # Optional: for odds fetching
FUNCTIONS_EMULATOR=         # Set to 'true' for local dev
```

## Emulator Ports

| Service     | Port | Notes                                                                  |
| ----------- | ---- | ---------------------------------------------------------------------- |
| Functions   | 5001 | API base: `http://127.0.0.1:5001/golf-pool-app-492300/us-central1/api` |
| Firestore   | 8080 |                                                                        |
| Auth        | 9099 |                                                                        |
| Emulator UI | 4000 |                                                                        |

## Deployment

- **Backend**: `cd functions && npm run deploy`
- **Frontend**: push to the linked GitHub branch — Firebase App Hosting deploys automatically. To trigger manually: `firebase apphosting:rollouts:create <backend-id>`
- **Full local**: `firebase emulators:start`
