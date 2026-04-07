"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildAuthPageHref } from "@/lib/auth/redirect";

/**
 * Client-side defense-in-depth auth gate. The primary auth check happens in
 * `web/middleware.ts` — if you got here without a __session cookie, you were
 * already redirected. This component exists to handle the narrow window where
 * the cookie expired / was revoked mid-session, or edge cases where SSR data
 * was rendered but the Firebase client SDK decided the user is gone.
 *
 * Critically: we render children immediately. No centered loader. The
 * middleware has already guaranteed the cookie exists; the only state we
 * flip into is "Firebase client says logged out, bounce to /login" — and
 * that should be vanishingly rare.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const currentPath = `${pathname}${window.location.search}`;
      router.replace(buildAuthPageHref("/login", currentPath));
    }
  }, [user, loading, pathname, router]);

  return <>{children}</>;
}
