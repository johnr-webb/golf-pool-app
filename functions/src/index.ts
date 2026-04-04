import * as functions from "firebase-functions";
import express from "express";
import cors from "cors";

import tournamentRoutes from "./routes/tournaments";
import poolRoutes from "./routes/pools";
import teamRoutes from "./routes/teams";

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

// Routes
app.use("/tournaments", tournamentRoutes);
app.use("/pools", poolRoutes);
app.use("/teams", teamRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

export const api = functions.https.onRequest(app);
