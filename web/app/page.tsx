"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Center, Loader } from "@mantine/core";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/pools" : "/login");
  }, [user, loading, router]);

  return (
    <Center h="100vh">
      <Loader />
    </Center>
  );
}
