import { Request, Response, NextFunction } from "express";
import { auth, db } from "../config/firebase";

export interface AuthRequest extends Request {
  uid?: string;
  admin?: boolean;
}

/**
 * Verify Firebase ID token from Authorization header.
 * Attaches uid and admin flag to the request.
 */
export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  console.debug(`Checking header for authorization: ${header}`);
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  try {
    const token = header.split("Bearer ")[1];
    const decoded = await auth.verifyIdToken(token);
    req.uid = decoded.uid;
    // Check admin status from users collection
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    if (userDoc.exists) {
      req.admin = userDoc.data()?.admin === true;
    } else {
      // Auto-create user doc on first API call
      await db
        .collection("users")
        .doc(decoded.uid)
        .set({
          email: decoded.email || "",
          displayName: decoded.name || "",
          admin: false,
          createdAt: new Date(),
        });
      req.admin = false;
    }

    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
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
