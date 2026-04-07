"use client";

import { startTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export function SignupForm() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      email: "",
      password: "",
      realName: "",
      displayName: "",
    },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Invalid email"),
      password: (v) => (v.length >= 6 ? null : "At least 6 characters"),
      realName: (v) => (v.trim().length > 0 ? null : "Required"),
      displayName: (v) => (v.trim().length > 0 ? null : "Required"),
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      await signUp(
        values.email,
        values.password,
        values.displayName,
        values.realName,
      );
      startTransition(() => {
        router.replace("/pools");
        router.refresh();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Stack gap="md" w={360}>
      <Title order={2}>Create account</Title>
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput
            label="Real name"
            description="Your legal name — kept private, used so pool admins know who's who"
            placeholder="Jane Smith"
            required
            {...form.getInputProps("realName")}
          />
          <TextInput
            label="Nickname"
            description="Public display name shown on leaderboards"
            placeholder="eagle-eye-jane"
            required
            {...form.getInputProps("displayName")}
          />
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
            autoComplete="new-password"
            {...form.getInputProps("password")}
          />
          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red">
              {error}
            </Alert>
          )}
          <Button type="submit" loading={submitting} fullWidth>
            Sign up
          </Button>
        </Stack>
      </form>
      <Anchor component={Link} href="/login" size="sm" ta="center">
        Already have an account? Sign in
      </Anchor>
    </Stack>
  );
}
