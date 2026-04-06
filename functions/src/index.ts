import * as functions from "firebase-functions";
import express from "express";
import cors from "cors";

import tournamentRoutes from "./routes/tournaments";
import poolRoutes from "./routes/pools";
import teamRoutes from "./routes/teams";
import userRoutes from "./routes/users";
import sessionRoutes from "./routes/session";
import devRoutes from "./routes/dev";

const app = express();

// credentials:true so the browser sends the __session cookie on cross-origin
// calls during local dev (Next dev server :3000 → emulator :5001). In prod
// the Next rewrite makes calls same-origin and CORS is a no-op.
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const baseRouter = express.Router();

// Routes
baseRouter.use("/tournaments", tournamentRoutes);
baseRouter.use("/pools", poolRoutes);
baseRouter.use("/teams", teamRoutes);
baseRouter.use("/users", userRoutes);
baseRouter.use("/session", sessionRoutes);

// Dev-only routes: auto-seed and reset for local testing.
// Guarded twice — mount condition here, and every handler in dev.ts re-checks
// FUNCTIONS_EMULATOR. Will never mount in production.
if (process.env.FUNCTIONS_EMULATOR === "true") {
  baseRouter.use("/dev", devRoutes);
}

// Health check
baseRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", baseRouter);

export const api = functions.https.onRequest(app);
