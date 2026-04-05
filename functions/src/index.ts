import * as functions from "firebase-functions";
import express from "express";
import cors from "cors";

import tournamentRoutes from "./routes/tournaments";
import poolRoutes from "./routes/pools";
import teamRoutes from "./routes/teams";
import devRoutes from "./routes/dev";

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

// Routes
app.use("/tournaments", tournamentRoutes);
app.use("/pools", poolRoutes);
app.use("/teams", teamRoutes);

// Dev-only routes: auto-seed and reset for local testing.
// Guarded twice — mount condition here, and every handler in dev.ts re-checks
// FUNCTIONS_EMULATOR. Will never mount in production.
if (process.env.FUNCTIONS_EMULATOR === "true") {
  app.use("/dev", devRoutes);
}

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

export const api = functions.https.onRequest(app);
