"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildAuthPageHref } from "@/lib/auth/redirect";

/**
 * Auth gate for the (app) layout. Waits for Firebase Auth to hydrate from
 * IndexedDB (~100-200ms), then either renders children or redirects to
 * /login. This is the single auth check — no edge middleware, no cookies.
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

  if (loading) return null;

  return <>{children}</>;
}
