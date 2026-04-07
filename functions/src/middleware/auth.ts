import { Request, Response, NextFunction } from "express";
import { auth, db } from "../config/firebase";

export interface AuthRequest extends Request {
  requestId?: string;
  uid?: string;
  admin?: boolean;
}

const SESSION_COOKIE_NAME = "__session";

/**
 * Extract and verify a caller identity from either:
 *   1. `Authorization: Bearer <idToken>` — client-side API calls that already
 *      have a fresh Firebase ID token in memory.
 *   2. `Cookie: __session=<sessionCookie>` — Next.js server components and the
 *      Next middleware route guard, which only see HttpOnly cookies.
 *
 * Returns the decoded token on success, or null if neither was present /
 * valid. Callers decide whether to 401.
 */
async function resolveIdentity(
  req: Request,
): Promise<{ uid: string; email?: string; name?: string } | null> {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    try {
      const token = header.split("Bearer ")[1];
      const decoded = await auth.verifyIdToken(token);
      return { uid: decoded.uid, email: decoded.email, name: decoded.name };
    } catch {
      // fall through to cookie attempt
    }
  }

  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(
      new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`),
    );
    if (match) {
      try {
        // checkRevoked=true so signing out in one tab kills other tabs.
        const decoded = await auth.verifySessionCookie(match[1], true);
        return {
          uid: decoded.uid,
          email: decoded.email,
          name: decoded.name as string | undefined,
        };
      } catch {
        // invalid / expired / revoked
      }
    }
  }

  return null;
}

/**
 * Verify caller identity from either a Bearer ID token or a `__session`
 * session cookie. Attaches uid and admin flag to the request.
 */
export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const identity = await resolveIdentity(req);
  if (!identity) {
    res.status(401).json({ error: "Missing or invalid credentials" });
    return;
  }

  req.uid = identity.uid;
  // Check admin status from users collection
  const userDoc = await db.collection("users").doc(identity.uid).get();
  if (userDoc.exists) {
    req.admin = userDoc.data()?.admin === true;
  } else {
    // Auto-create user doc on first API call
    await db
      .collection("users")
      .doc(identity.uid)
      .set({
        email: identity.email || "",
        displayName: identity.name || "",
        realName: "",
        admin: false,
        createdAt: new Date(),
      });
    req.admin = false;
  }

  next();
}

/**
 * Require the user to be an admin.
 * Must be used after requireAuth.
 */
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.admin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
