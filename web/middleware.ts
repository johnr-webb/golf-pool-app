import { NextResponse, type NextRequest } from "next/server";

// Next.js edge middleware. Runs before any page renders. Its job is
// cheap: check whether the __session cookie is present and redirect to
// /login if not. We do NOT verify the cookie here — edge runtime can't
// run firebase-admin (Node-only). Full verification happens in the
// backend's requireAuth middleware when the actual API call fires.
//
// Authed users hitting /login or /signup get bounced to /pools.
//
// Why this kills the biggest loading spinner:
// previously the browser had to download the whole app bundle, rehydrate
// Firebase Auth from IndexedDB, then run <AuthGate> client-side. Now
// unauthed users get a 302 to /login before a single React byte ships.

const SESSION_COOKIE = "__session";

// Paths that never require auth.
const PUBLIC_PATHS = ["/login", "/signup"];

// Paths/prefixes the middleware should completely ignore (handled by the
// `matcher` below, listed here for documentation).
//   /_next/*   — Next internals
//   /api/*     — proxied to Express, which has its own auth
//   /favicon.* — static assets

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (isPublic(pathname)) {
    // Bounce already-authed users away from auth pages.
    if (hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/pools";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // Preserve where the user was trying to go so /login can bounce them back.
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match everything except Next internals, the API proxy, and static assets.
    "/((?!_next/|api/|favicon|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif|txt|xml)).*)",
  ],
};
