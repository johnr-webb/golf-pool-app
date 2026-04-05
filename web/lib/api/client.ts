"use client";

// Typed fetch wrapper for the Express API. Attaches the current Firebase ID
// token as a Bearer header, retries once on 401 with a force-refreshed token,
// and throws ApiError for non-2xx responses.
//
// All authed data access in the app goes through this wrapper. Never import
// Firestore directly in components.

import { getFirebaseAuth } from "@/lib/firebase/client";
import { apiBaseUrl } from "@/lib/firebase/config";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function buildHeaders(
  init: RequestInit,
  forceRefresh: boolean,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const user = getFirebaseAuth().currentUser;
  if (user) {
    const token = await user.getIdToken(forceRefresh);
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(body: unknown, status: number): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  return `API ${status}`;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${apiBaseUrl}${path}`;

  // credentials: "include" so the __session cookie rides along on every call.
  // Bearer token is still attached in buildHeaders() as a fallback for any
  // request that fires before POST /session has set the cookie — requireAuth
  // on the backend accepts either credential.
  const fetchOpts: RequestInit = { cache: "no-store", credentials: "include" };

  // First attempt with cached token
  let headers = await buildHeaders(init, false);
  let res = await fetch(url, { ...init, ...fetchOpts, headers });

  // On 401, force-refresh the token and retry exactly once
  if (res.status === 401 && getFirebaseAuth().currentUser) {
    headers = await buildHeaders(init, true);
    res = await fetch(url, { ...init, ...fetchOpts, headers });
  }

  const body = await parseBody(res);

  if (!res.ok) {
    throw new ApiError(res.status, extractErrorMessage(body, res.status), body);
  }

  return body as T;
}
