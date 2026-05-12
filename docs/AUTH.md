# Golf Pool App - Authentication System

## Overview

The app uses Firebase Auth with a session cookie bridge to support both client-side and server-side authentication.

## Authentication Methods

| Method | Used By | Purpose |
|--------|---------|---------|
| Firebase ID Token | Client API calls | Bearer token in Authorization header |
| Session Cookie | SSR + Middleware | Cookie-based auth for Next.js |

## Session Cookie Bridge

Firebase session cookies provide a bridge between Firebase Auth and Next.js server components.

```
Client                         Server                         Firebase
──────                         ──────                         ────────
signIn()
  │                           
  │  getIdToken()            
  ▼                           
ID Token ────────────────────► POST /session                
                                { idToken }                  
                                  │                          
                                  │ verifyIdToken(idToken)    
                                  ▼                          
                               Session Cookie ◄──────────────
                                  │                          
                                  │ Set-Cookie: __session    
                                  ▼                          
                               "success"                     

All subsequent requests:
  │ ────────────────────────────► Cookie: __session
  │                               │
  │                               │ requireAuth checks cookie
  │                               ▼
  │                            Authenticated!
```

## Flow Details

### 1. Sign In / Sign Up

```typescript
// Client: AuthProvider.tsx
async function handleSignIn(email: string, password: string) {
  // Firebase Auth
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  
  // Get fresh ID token
  const idToken = await user.getIdToken();
  
  // Exchange for session cookie
  await fetch('/session', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
    credentials: 'include',
  });
  
  // Update auth state
  setUser(user);
}
```

### 2. Middleware Auth Check

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('__session');
  
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/pools/:path*',
    '/((?!login|signup|api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### 3. Backend Auth Middleware

```typescript
// middleware/auth.ts
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Check Bearer token first (client-side API calls)
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const idToken = authHeader.slice(7);
    try {
      const decoded = await auth.verifyIdToken(idToken);
      req.uid = decoded.uid;
      await attachAdminFlag(req);
      return next();
    } catch {
      // Token invalid, try cookie
    }
  }
  
  // Check session cookie (SSR)
  const sessionCookie = req.cookies.get('__session');
  if (sessionCookie) {
    try {
      const decoded = await auth.verifySessionCookie(sessionCookie);
      req.uid = decoded.uid;
      await attachAdminFlag(req);
      return next();
    } catch {
      // Cookie invalid
    }
  }
  
  return res.status(401).json({ error: 'Unauthorized' });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.admin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
```

### 4. Sign Out

```typescript
// Client: AuthProvider.tsx
async function handleSignOut() {
  // 1. Revoke session cookie and refresh tokens
  await fetch('/session', {
    method: 'DELETE',
    credentials: 'include',
  });
  
  // 2. Firebase sign out
  await signOut(auth);
  
  // 3. Clear local state
  setUser(null);
  
  // 4. Redirect to login
  router.push('/login');
}
```

## Session Cookie Configuration

```typescript
// routes/session.ts
app.post('/session', async (req, res) => {
  const { idToken } = req.body;
  
  // Verify the ID token
  const decoded = await auth.verifyIdToken(idToken);
  
  // Create session cookie (5 days - max allowed)
  const expiresIn = 5 * 24 * 60 * 60 * 1000; // 5 days
  const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
  
  // Set cookie
  res.cookie('__session', sessionCookie, {
    maxAge: expiresIn,
    httpOnly: true,
    secure: true,           // HTTPS only in production
    sameSite: 'lax',
    path: '/',
  });
  
  res.json({ success: true });
});
```

## Admin Promotion

Admin status is stored in Firestore, not custom claims:

```typescript
// Admin flag attached on first auth
async function attachAdminFlag(req: Request) {
  const userDoc = await db.collection('users').doc(req.uid!).get();
  const data = userDoc.data();
  
  if (!data) {
    // Auto-create user doc
    await db.collection('users').doc(req.uid!).set({
      email: req.user?.email || '',
      displayName: req.user?.name || '',
      admin: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    req.admin = false;
  } else {
    req.admin = data.admin ?? false;
  }
}
```

### Promoting a User to Admin

```bash
# Firebase Console
1. Go to Firestore
2. Navigate to users/{uid}
3. Set admin: true
```

Or via admin script:

```typescript
// Promote user via API or script
await db.collection('users').doc(uid).update({ admin: true });
```

## Auth Guard Component

```typescript
// components/auth/AuthGate.tsx
'use client';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  if (!user) {
    return null;
  }
  
  return <>{children}</>;
}
```

## Error Handling

| Scenario | Client Response | User Experience |
|----------|----------------|-----------------|
| No session | Redirect to `/login?next=<path>` | Login page |
| Token expired | Auto-refresh + retry once | Transparent retry |
| Session cookie invalid | Redirect to `/login` | Login page |
| Admin required | 403 Forbidden | Error message |

## Security Considerations

1. **HttpOnly Cookie**: Prevents XSS access to session cookie
2. **Secure Flag**: Cookie only sent over HTTPS
3. **SameSite=Lax**: Prevents CSRF while allowing navigation
4. **5-Day Expiry**: Balance between UX and security
5. **Refresh Token Revocation**: Invalidates all sessions on sign-out

## Testing Locally

Use the `local-dev-setup.sh` script to create test users:

```bash
./scripts/local-dev-setup.sh
# Output includes user UIDs and ID tokens for testing
```

Test credentials:
- Admin: `admin@test.com` / `password123`
- User: `user@test.com` / `password123`
