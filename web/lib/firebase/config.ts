// Firebase client configuration. Read from NEXT_PUBLIC_* env vars at build time.
// These values are baked into the client bundle by Next — the API key is not
// actually secret (Firebase web keys are identifiers, not credentials), but we
// still source sensitive ones from Secret Manager via apphosting.yaml.

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

export const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

// Same-origin base path. `/api/*` is proxied to the Express function by Next
// rewrites (see web/next.config.ts) so that the __session HttpOnly cookie is
// first-party and flows both directions without cross-site cookie rules.
// Overridable only for unusual local setups; the default is what you want.
export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL && process.env.NEXT_PUBLIC_API_BASE_URL.length > 0
    ? process.env.NEXT_PUBLIC_API_BASE_URL
    : "/api";
