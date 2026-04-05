import { apiFetch } from "./client";
import type { Me, UpdateMeInput } from "@/lib/types/api";

export const getMe = () => apiFetch<Me>("/users/mine");

export const updateMe = (body: UpdateMeInput) =>
  apiFetch<Me>("/users/mine", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
