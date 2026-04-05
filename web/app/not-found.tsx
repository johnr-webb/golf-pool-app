import Link from "next/link";
import { Button, Center, Stack, Text, Title } from "@mantine/core";

export default function NotFound() {
  return (
    <Center h="100vh">
      <Stack align="center" gap="sm">
        <Title order={2}>Not found</Title>
        <Text c="dimmed">This page doesn&apos;t exist.</Text>
        <Button component={Link} href="/pools" mt="sm">
          Go to pools
        </Button>
      </Stack>
    </Center>
  );
}
