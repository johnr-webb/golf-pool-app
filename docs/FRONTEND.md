# Golf Pool App - Frontend Architecture

## Overview

The frontend is a Next.js 15 App Router application with React 19 and Mantine v7.

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | Next.js 15 | App Router, SSR, API routes |
| UI Library | Mantine v7 | Components, forms, notifications |
| State/Fetching | TanStack Query | Server state, caching |
| Auth | Firebase Auth | Client-side authentication |
| Styling | Mantine + CSS Modules | Component styling |

## Directory Structure

```
web/
├── app/
│   ├── (auth)/              # Unauthenticated pages
│   │   ├── layout.tsx       # Auth layout (no AppShell)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── signup/
│   │       └── page.tsx
│   │
│   ├── (app)/               # Authenticated pages
│   │   ├── layout.tsx       # App layout with AppShell
│   │   └── pools/
│   │       ├── page.tsx                    # Pool list
│   │       ├── new/
│   │       │   └── page.tsx                # Create pool
│   │       └── [poolId]/
│   │           ├── page.tsx                # Pool detail + leaderboard
│   │           ├── join/
│   │           │   └── page.tsx            # Join pool
│   │           ├── team/
│   │           │   ├── new/
│   │           │   │   └── page.tsx        # Create team
│   │           │   └── edit/
│   │           │       └── page.tsx        # Edit team
│   │
│   ├── layout.tsx           # Root layout
│   └── globals.css
│
├── components/
│   ├── auth/
│   │   ├── AuthGate.tsx     # Redirect if not authenticated
│   │   ├── LoginForm.tsx
│   │   └── SignupForm.tsx
│   │
│   ├── pools/
│   │   ├── PoolList.tsx
│   │   ├── PoolCard.tsx
│   │   ├── PoolDetailView.tsx
│   │   ├── PoolCreateForm.tsx
│   │   ├── TierRepeater.tsx
│   │   └── JoinPoolModal.tsx
│   │
│   ├── leaderboard/
│   │   ├── Leaderboard.tsx          # Router: Masters vs ESPN
│   │   ├── LeaderboardActive.tsx    # Accordion of scored teams
│   │   ├── LeaderboardUpcoming.tsx  # Accordion before tournament
│   │   ├── PlayerScoreRow.tsx
│   │   └── TournamentStatusBadge.tsx
│   │
│   ├── teams/
│   │   ├── TeamPicker.tsx     # Multi-select with tier validation
│   │   ├── TierSection.tsx    # Single tier with player multiselect
│   │   └── TeamLockBanner.tsx # Warning when tournament active
│   │
│   ├── masters/               # Masters.com-specific UI
│   │   ├── MastersLeaderboardContainer.tsx
│   │   ├── MastersLeaderboard.tsx
│   │   ├── MastersHero.tsx
│   │   ├── MastersTicker.tsx
│   │   ├── MastersTeamCard.tsx
│   │   ├── MastersPlayerRow.tsx
│   │   ├── MastersScorecard.tsx
│   │   └── MastersScorecardCell.tsx
│   │
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   └── UserMenu.tsx
│   │
│   └── common/
│       ├── ErrorAlert.tsx
│       └── LoadingCard.tsx
│
├── lib/
│   ├── api/                  # API client modules
│   │   ├── client.ts         # Core fetch with token refresh
│   │   ├── server.ts         # Server-side fetch
│   │   ├── pools.ts
│   │   ├── pools-server.ts
│   │   ├── teams.ts
│   │   ├── tournaments.ts
│   │   ├── users.ts
│   │   └── session.ts
│   │
│   ├── firebase/
│   │   ├── config.ts         # Environment config
│   │   └── client.ts         # Firebase Auth init
│   │
│   ├── masters/              # Masters.com integration
│   │   ├── api.ts            # Fetch from masters.com
│   │   ├── scoring.ts        # Client-side scoring
│   │   ├── types.ts
│   │   └── flags.ts          # Country code to flag emoji
│   │
│   ├── query/
│   │   └── QueryProvider.tsx # TanStack Query setup
│   │
│   └── validation/
│       └── tiers.ts           # Client-side tier validation
│
├── middleware.ts             # Edge middleware for auth
└── next.config.js
```

## Pages

### Auth Pages (`/(auth)`)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/login` | `LoginForm` | Email/password sign-in |
| `/signup` | `SignupForm` | Create account with realName, displayName |

### App Pages (`/(app)`)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/pools` | `PoolList` + Server | Pool browser with SSR |
| `/pools/new` | `PoolCreateForm` | Create pool (admin only) |
| `/pools/:poolId` | `PoolDetailView` | Pool header + leaderboard |
| `/pools/:poolId/join` | `JoinPoolModal` | Join with password |
| `/pools/:poolId/team/new` | `TeamPicker` | Pick players |
| `/pools/:poolId/team/edit` | `TeamPicker` | Edit existing picks |

## Authentication Flow

### Sign Up
```typescript
async function handleSignup(email: string, password: string, realName: string, displayName: string) {
  // 1. Create Firebase user
  const { user } = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  
  // 2. Set display name
  await updateProfile(user, { displayName });
  
  // 3. Get fresh ID token
  const idToken = await user.getIdToken();
  
  // 4. Create session cookie
  await createSession({ idToken });
  
  // 5. Seed user profile to Firestore
  await updateMe({ realName, displayName });
  
  // 6. Redirect to pools
  router.push('/pools');
}
```

### Sign In
```typescript
async function handleLogin(email: string, password: string) {
  // 1. Sign in with Firebase
  const { user } = await signInWithEmailAndPassword(firebaseAuth, email, password);
  
  // 2. Get fresh ID token
  const idToken = await user.getIdToken();
  
  // 3. Create session cookie
  await createSession({ idToken });
  
  // 4. Redirect
  router.push('/pools');
}
```

### Middleware
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  // Check for __session cookie
  const session = request.cookies.get('__session');
  
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/pools/:path*', '/((?!login|signup|api|_next/static|_next/image|favicon.ico).*)'],
};
```

## API Client

### Client-Side (`lib/api/client.ts`)

```typescript
export async function apiFetch<T>(
  endpoint: string,
  options: { token?: string; ... } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...fetchOptions,
    headers,
    credentials: 'include',  // Include cookies
  });
  
  if (response.status === 401) {
    // Token expired, refresh and retry once
    const newToken = await refreshToken();
    headers['Authorization'] = `Bearer ${newToken}`;
    const retryResponse = await fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    });
    return handleResponse(retryResponse);
  }
  
  return handleResponse(response);
}
```

### Server-Side (`lib/api/server.ts`)

```typescript
export async function apiFetchServer<T>(
  endpoint: string,
  request: NextRequest
): Promise<T> {
  const sessionCookie = request.cookies.get('__session')?.value;
  
  if (!sessionCookie) {
    throw new Error('No session');
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Cookie': `__session=${sessionCookie}`,
    },
    credentials: 'include',
  });
  
  return handleResponse(response);
}
```

## TanStack Query Setup

```typescript
// QueryProvider.tsx
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,     // 30 seconds
            gcTime: 5 * 60 * 1000,    // 5 minutes
            retry: 2,
            refetchOnWindowFocus: true,
          },
        },
      })
  );
  
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

### Query Keys

```typescript
export const queryKeys = {
  pools: {
    all: ['pools'] as const,
    mine: ['pools', 'mine'] as const,
    detail: (poolId: string) => ['pools', poolId] as const,
    leaderboard: (poolId: string) => ['pools', poolId, 'leaderboard'] as const,
  },
  teams: {
    detail: (teamId: string) => ['teams', teamId] as const,
  },
  tournaments: {
    all: ['tournaments'] as const,
    players: (tournamentId: string) => ['tournaments', tournamentId, 'players'] as const,
  },
  users: {
    me: ['users', 'me'] as const,
  },
};
```

## Component Patterns

### Server Component with Hydration
```typescript
// app/pools/page.tsx
export default async function PoolsPage() {
  // Fetch data server-side
  const pools = await fetchPoolsServer();
  
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PoolList initialPools={pools} />
    </HydrationBoundary>
  );
}
```

### Client Component with TanStack Query
```typescript
// components/pools/PoolList.tsx
'use client';

export function PoolList({ initialPools }: { initialPools: Pool[] }) {
  const { data: pools } = useQuery({
    queryKey: queryKeys.pools.mine,
    queryFn: listMyPools,
    initialData: initialPools,
  });
  
  return (
    <Grid>
      {pools?.map(pool => (
        <PoolCard key={pool.id} pool={pool} />
      ))}
    </Grid>
  );
}
```

### Form with Mantine
```typescript
// components/auth/LoginForm.tsx
export function LoginForm() {
  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      password: (value) => (value.length >= 6 ? null : 'Password too short'),
    },
  });
  
  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <TextInput {...form.getInputProps('email')} label="Email" />
      <PasswordInput {...form.getInputProps('password')} label="Password" />
      <Button type="submit">Sign In</Button>
    </form>
  );
}
```

## Mantine Theming

```typescript
// app/layout.tsx
import { MantineProvider, createTheme } from '@mantine/core';

const theme = createTheme({
  primaryColor: 'green',
  fontFamily: 'Inter, system-ui, sans-serif',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MantineProvider theme={theme}>
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
```

## Masters-Specific Features

For tournaments with `mastersYear`, the app uses masters.com directly:

### Data Fetching
```typescript
// lib/masters/api.ts
export async function fetchMastersScores(year: number) {
  const response = await fetch(`https://api.masters.com Leaderboard`);
  return response.json();
}
```

### Client-Side Scoring
```typescript
// lib/masters/scoring.ts
export function calculateMastersScore(
  teamPicks: MastersPlayer[],
  scores: Map<string, number>
): TeamScore {
  // Apply missed-cut penalty
  // Calculate best-N-of-M
  // Return ranked results
}
```

### Auto-Refresh
```typescript
// components/masters/MastersLeaderboardContainer.tsx
const { data } = useQuery({
  queryKey: ['masters', year, 'scores'],
  queryFn: () => fetchMastersScores(year),
  refetchInterval: 30 * 1000,  // 30 seconds
});
```
