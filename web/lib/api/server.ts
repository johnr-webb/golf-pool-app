// Server-side fetch wrapper. ONLY usable from Server Components, route
// handlers, and other server-only code — imports next/headers, which will
// throw if called from client code.
//
// Reads the __session HttpOnly cookie from the incoming request and forwards
// it to the Express API. The backend's requireAuth middleware accepts either
// Bearer or __session; from the server side, cookie is the only option.

import "server-only";
import { cookies } from "next/headers";
import { ApiError } from "./client";

// Direct URL to the Express function. We bypass the /api/* rewrite here
// because we're already on the server — no need for the browser-side
// same-origin trick. Same env var used by next.config.ts.
const API_TARGET =
  process.env.API_REWRITE_TARGET ??
  "http://127.0.0.1:5001/golf-pool-app-492300/us-central1/api";

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

export async function apiFetchServer<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (sessionCookie) {
    headers.Cookie = `__session=${sessionCookie.value}`;
  }

  const res = await fetch(`${API_TARGET}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const body = await parseBody(res);

  if (!res.ok) {
    throw new ApiError(res.status, extractErrorMessage(body, res.status), body);
  }

  return body as T;
}
