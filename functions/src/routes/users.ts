import { Router } from "express";
import { db } from "../config/firebase";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { logRouteAck, logRouteStep } from "../utils/logging";

const router = Router();

// GET /users/mine — Current user profile
// Returns the Firestore user doc for the authed caller. requireAuth has
// already auto-created the doc on first API call, so this always finds one.
router.get("/mine", requireAuth, async (req: AuthRequest, res) => {
  logRouteAck("GET /users/mine", req);

  const doc = await db.collection("users").doc(req.uid!).get();
  if (!doc.exists) {
    // Shouldn't happen — requireAuth creates it. Defensive.
    res.status(404).json({ error: "User not found" });
    return;
  }
  const data = doc.data()!;
  res.json({
    uid: doc.id,
    email: data.email ?? "",
    displayName: data.displayName ?? "",
    realName: data.realName ?? "",
    admin: data.admin === true,
  });
});

// PATCH /users/mine — Update display name and/or real name.
// Used by the signup flow to seed realName after Firebase Auth account creation,
// and by the profile editor later. Admin flag is NOT mutable here.
router.patch("/mine", requireAuth, async (req: AuthRequest, res) => {
  const { displayName, realName } = req.body ?? {};
  logRouteAck("PATCH /users/mine", req, {
    updates: {
      displayName: displayName !== undefined,
      realName: realName !== undefined,
    },
  });

  const updates: Record<string, string> = {};

  if (displayName !== undefined) {
    if (typeof displayName !== "string" || displayName.trim().length === 0) {
      res.status(400).json({ error: "displayName must be a non-empty string" });
      return;
    }
    updates.displayName = displayName.trim();
  }

  if (realName !== undefined) {
    if (typeof realName !== "string" || realName.trim().length === 0) {
      res.status(400).json({ error: "realName must be a non-empty string" });
      return;
    }
    updates.realName = realName.trim();
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No updatable fields provided" });
    return;
  }

  logRouteStep("PATCH /users/mine", req, "updating user profile", {
    updatedFields: Object.keys(updates),
  });
  await db.collection("users").doc(req.uid!).update(updates);

  const doc = await db.collection("users").doc(req.uid!).get();
  const data = doc.data()!;
  res.json({
    uid: doc.id,
    email: data.email ?? "",
    displayName: data.displayName ?? "",
    realName: data.realName ?? "",
    admin: data.admin === true,
  });
});

export default router;
