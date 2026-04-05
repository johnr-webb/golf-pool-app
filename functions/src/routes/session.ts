import { Router } from "express";
import { auth } from "../config/firebase";

const router = Router();

// Session cookie lifetime: 5 days. Firebase caps session cookies at 2 weeks.
// We stay well under that so token revocation has a shorter blast radius.
const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

// The cookie MUST be named `__session`. Firebase App Hosting's CDN strips
// every cookie except that exact name before forwarding requests to the
// Next.js origin, so any other name would break in production.
const COOKIE_NAME = "__session";

function buildCookie(value: string, maxAgeMs: number): string {
  const secure = process.env.FUNCTIONS_EMULATOR === "true" ? "" : " Secure;";
  // SameSite=Lax is fine: the cookie is first-party (same origin as the Next
  // app via rewrite). We don't need cross-site submission.
  return (
    `${COOKIE_NAME}=${value};` +
    ` Path=/;` +
    ` HttpOnly;` +
    `${secure}` +
    ` SameSite=Lax;` +
    ` Max-Age=${Math.floor(maxAgeMs / 1000)}`
  );
}

// POST /session — Exchange a Firebase ID token for a server-verified
// session cookie. Called by the web app immediately after sign-in / sign-up.
router.post("/", async (req, res) => {
  const { idToken } = req.body ?? {};
  if (!idToken || typeof idToken !== "string") {
    res.status(400).json({ error: "idToken is required" });
    return;
  }

  try {
    // Verify first so we reject forged tokens before minting a cookie.
    const decoded = await auth.verifyIdToken(idToken, true);

    // Firebase requires tokens to be recent (< 5 min) to mint a session cookie.
    const authTimeSec = decoded.auth_time;
    if (Date.now() / 1000 - authTimeSec > 5 * 60) {
      res.status(401).json({ error: "Recent sign-in required" });
      return;
    }

    const cookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });
    res.setHeader("Set-Cookie", buildCookie(cookie, SESSION_DURATION_MS));
    res.json({ success: true });
  } catch {
    res.status(401).json({ error: "Invalid ID token" });
  }
});

// DELETE /session — Clear the session cookie and revoke refresh tokens so
// any still-live ID tokens for this user can no longer mint new cookies.
router.delete("/", async (req, res) => {
  const header = req.headers.cookie ?? "";
  const match = header.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (match) {
    try {
      const decoded = await auth.verifySessionCookie(match[1]);
      await auth.revokeRefreshTokens(decoded.sub);
    } catch {
      // Cookie was invalid / expired — still clear it below.
    }
  }
  res.setHeader("Set-Cookie", buildCookie("", 0));
  res.json({ success: true });
});

export default router;
