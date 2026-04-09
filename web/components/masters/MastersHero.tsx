"use client";

import { formatScore } from "@/lib/utils/format";
import styles from "./masters.module.css";

interface Props {
  currentRound: number;
  status: "active" | "completed";
  myTeamRank: number | null;
  myTeamScore: number | null;
  fieldSize: number;
}

export function MastersHero({ currentRound, status, myTeamRank, myTeamScore, fieldSize }: Props) {
  return (
    <div className={styles.hero}>
      <div className={styles.heroSubtitle}>Augusta National Golf Club</div>
      <div className={styles.heroTitle}>The Masters</div>
      <div className={styles.heroRound}>
        {status === "completed"
          ? "Final Results"
          : `Round ${currentRound} · April 2026`}
      </div>
      <div className={styles.heroStats}>
        {myTeamRank !== null && (
          <div>
            <span className={styles.heroStatLabel}>Your Team</span>
            <span style={{ fontWeight: 700 }}>
              {myTeamRank === 1 ? "1st" : myTeamRank === 2 ? "2nd" : myTeamRank === 3 ? "3rd" : `${myTeamRank}th`}
            </span>{" "}
            <span style={{ color: "#4ade80" }}>({formatScore(myTeamScore)})</span>
          </div>
        )}
        <div style={{ borderLeft: "1px solid rgba(255,255,255,0.15)", paddingLeft: 20 }}>
          <span className={styles.heroStatLabel}>Field</span>
          {fieldSize} players
        </div>
      </div>
    </div>
  );
}
