import type { NextConfig } from "next";

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
};

export default config;
