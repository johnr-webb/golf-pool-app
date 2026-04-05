"use client";

import { useRouter } from "next/navigation";
import { Avatar, Menu, UnstyledButton, Group, Text } from "@mantine/core";
import { IconLogout } from "@tabler/icons-react";
import { useAuth } from "@/lib/auth/AuthProvider";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const name = user.displayName || user.email || "Account";
  const initials = (name[0] ?? "?").toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <Menu position="bottom-end" withArrow>
      <Menu.Target>
        <UnstyledButton>
          <Group gap="xs">
            <Avatar color="green" radius="xl" size="sm">
              {initials}
            </Avatar>
            <Text size="sm" fw={500}>
              {name}
            </Text>
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconLogout size={14} />}
          onClick={handleSignOut}
        >
          Sign out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
