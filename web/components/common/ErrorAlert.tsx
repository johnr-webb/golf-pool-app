"use client";

import { Alert } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";

export function ErrorAlert({
  title = "Something went wrong",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <Alert icon={<IconAlertCircle size={16} />} color="red" title={title}>
      {message}
    </Alert>
  );
}
