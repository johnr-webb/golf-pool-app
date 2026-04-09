import { Request, Response, NextFunction } from "express";
import * as logger from "firebase-functions/logger";
import { auth, db } from "../config/firebase";

export interface AuthRequest extends Request {
  requestId?: string;
  uid?: string;
  admin?: boolean;
}

/**
 * Verify the `Authorization: Bearer <idToken>` header via Firebase Admin.
 * Returns the decoded identity on success, or null if missing / invalid.
 */
async function resolveIdentity(
  req: Request,
): Promise<{ uid: string; email?: string; name?: string } | null> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  try {
    const token = header.split("Bearer ")[1];
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email, name: decoded.name };
  } catch (err) {
    logger.warn("auth: Bearer token verification failed", {
      path: req.originalUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Verify caller identity from a Bearer ID token.
 * Attaches uid and admin flag to the request.
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
