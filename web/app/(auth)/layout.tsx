"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Center } from "@mantine/core";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // If already signed in, bounce to the app.
  useEffect(() => {
    if (!loading && user) {
      router.replace("/pools");
    }
  }, [user, loading, router]);

  return <Center h="100vh">{children}</Center>;
}
