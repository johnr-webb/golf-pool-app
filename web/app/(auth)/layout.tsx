"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Center } from "@mantine/core";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getSafeAuthRedirect } from "@/lib/auth/redirect";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // If already signed in, bounce to the app.
  useEffect(() => {
    if (!loading && user) {
      const searchParams = new URLSearchParams(window.location.search);
      router.replace(getSafeAuthRedirect(searchParams.get("next")));
    }
  }, [user, loading, router]);

  return <Center h="100vh">{children}</Center>;
}
