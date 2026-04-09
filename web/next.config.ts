import type { NextConfig } from "next";

const API_TARGET =
  process.env.INTERNAL_API_URL ||
  "https://us-central1-golf-pool-app-492300.cloudfunctions.net/api";

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
        // Browser calls /api/pools/mine → Next proxies to the Express
        // Cloud Function so the frontend doesn't need to know the function URL.
        source: "/api/:path*",
        destination: `${API_TARGET}/:path*`,
      },
    ];
  },
};

export default config;
