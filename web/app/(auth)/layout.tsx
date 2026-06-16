"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Box, Card, Center, Stack } from "@mantine/core";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getSafeAuthRedirect } from "@/lib/auth/redirect";
import { USOpenLogo } from "@/components/brand/USOpenLogo";

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

  return (
    <Box
      h="100vh"
      style={{
        background:
          "linear-gradient(160deg, var(--mantine-color-usoNavy-9) 0%, var(--mantine-color-usoNavy-7) 100%)",
      }}
    >
      <Center h="100%" px="md">
        <Stack align="center" gap="lg">
          <Box
            px="xl"
            py="md"
            bg="white"
            style={{ borderRadius: "var(--mantine-radius-md)" }}
          >
            <USOpenLogo height={44} priority />
          </Box>
          <Card
            withBorder
            shadow="md"
            radius="md"
            padding="xl"
            style={{ borderTop: "4px solid var(--mantine-color-usoRed-6)" }}
          >
            {children}
          </Card>
        </Stack>
      </Center>
    </Box>
  );
}
