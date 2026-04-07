import type { NextConfig } from "next";

// Express API base URL that Next will proxy `/api/*` to. Same value as the
// Cloud Functions HTTP URL locally (emulator) and in prod (deployed function).
// Server-only — not `NEXT_PUBLIC_*` — because the browser should only ever
// see `/api/...` (same-origin), which is what makes __session cookies work.

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL &&
  process.env.NEXT_PUBLIC_API_BASE_URL.length > 0
    ? process.env.NEXT_PUBLIC_API_BASE_URL
    : "/api";

const API_TARGET = process.env.INTERNAL_API_URL;

const config: NextConfig = {
  reactStrictMode: true,
  // typedRoutes disabled: our app has many dynamic segments and template-literal
  // hrefs that typedRoutes can't statically verify. We lean on runtime params
  // and TS checks elsewhere.
  typedRoutes: false,
  // Skip ESLint during `next build` — the parent repo's eslint config lives at
  // golf-pool-app/eslint.config.js (targets the functions package) and Next
  // accidentally picks it up. Lint is still runnable via `npm run lint`.
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        // Browser calls /api/pools/mine (same-origin) → Next proxies to the
        // Express function. Same-origin is what lets the __session HttpOnly
        // cookie flow back and forth without cross-site gymnastics.
        source: "/api/:path*",
        destination: `/${API_TARGET}/:path*`,
      },
    ];
  },
};

export default config;
