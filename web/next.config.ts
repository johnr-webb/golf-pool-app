import type { NextConfig } from "next";

// Express API base URL that Next will proxy `/api/*` to. Same value as the
// Cloud Functions HTTP URL locally (emulator) and in prod (deployed function).
// Server-only — not `NEXT_PUBLIC_*` — because the browser should only ever
// see `/api/...` (same-origin), which is what makes __session cookies work.
const API_REWRITE_TARGET =
  process.env.API_REWRITE_TARGET ??
  "http://127.0.0.1:5001/golf-pool-app-492300/us-central1/api";

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
        destination: `${API_REWRITE_TARGET}/:path*`,
      },
    ];
  },
};

export default config;
