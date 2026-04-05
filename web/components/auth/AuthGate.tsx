"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Center, Loader } from "@mantine/core";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * Client-side auth gate. Loading → spinner. Unauthed → redirect to /login.
 * Authed → render children.
 *
 * Next middleware is not used for auth because Firebase ID tokens live in
 * IndexedDB, not cookies. A session cookie bridge is deferred to phase 2.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  return <>{children}</>;
}
