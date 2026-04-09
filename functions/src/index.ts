import * as functions from "firebase-functions";
import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";

import tournamentRoutes from "./routes/tournaments";
import poolRoutes from "./routes/pools";
import teamRoutes from "./routes/teams";
import userRoutes from "./routes/users";
import devRoutes from "./routes/dev";
import { logRouteAck } from "./utils/logging";
import { AuthRequest } from "./middleware/auth";

const app = express();

// origin:true echoes back the requester's origin during local dev (Next :3000
// → emulator :5001). In prod the Next rewrite makes calls same-origin.
app.use(cors({ origin: true }));
app.use(express.json());
app.use((req: AuthRequest, res, next) => {
  const headerValue = req.header("x-request-id")?.trim();
  const requestId =
    headerValue && headerValue.length > 0
      ? headerValue.slice(0, 128)
      : randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});

const router = express.Router();

// Routes
router.use("/tournaments", tournamentRoutes);
router.use("/pools", poolRoutes);
router.use("/teams", teamRoutes);
router.use("/users", userRoutes);

// Dev-only routes: auto-seed and reset for local testing.
// Guarded twice — mount condition here, and every handler in dev.ts re-checks
// FUNCTIONS_EMULATOR. Will never mount in production.
if (process.env.FUNCTIONS_EMULATOR === "true") {
  router.use("/dev", devRoutes);
}

// Health check
router.get("/health", (req, res) => {
  logRouteAck("GET /health", req);
  res.json({ status: "ok" });
});

app.use(router);

export const api = functions.https.onRequest(app);
