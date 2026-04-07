"use client";

import { startTransition, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Anchor,
  Button,
  PasswordInput,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle } from "@tabler/icons-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildAuthPageHref, getSafeAuthRedirect } from "@/lib/auth/redirect";

export function LoginForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    initialValues: { email: "", password: "" },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Invalid email"),
      password: (v) => (v.length >= 6 ? null : "At least 6 characters"),
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      await signIn(values.email, values.password);
      const safeNext = getSafeAuthRedirect(nextPath);
      startTransition(() => {
        router.replace(safeNext);
        router.refresh();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Stack gap="md" w={360}>
      <Title order={2}>Sign in</Title>
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput
            label="Email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            {...form.getInputProps("email")}
          />
          <PasswordInput
            label="Password"
            required
            autoComplete="current-password"
            {...form.getInputProps("password")}
          />
          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red">
              {error}
            </Alert>
          )}
          <Button type="submit" loading={submitting} fullWidth>
            Sign in
          </Button>
        </Stack>
      </form>
      <Anchor
        component={Link}
        href={buildAuthPageHref("/signup", nextPath)}
        size="sm"
        ta="center"
      >
        Don&apos;t have an account? Sign up
      </Anchor>
    </Stack>
  );
}
