"use client";

import { useAuth } from "@/lib/auth/AuthProvider";
import type { MastersLeaderboardResponse } from "@/lib/masters/types";
import { MastersHero } from "./MastersHero";
import { MastersTicker } from "./MastersTicker";
import { MastersTeamCard } from "./MastersTeamCard";
import styles from "./masters.module.css";

interface Props {
  data: MastersLeaderboardResponse;
}

export function MastersLeaderboard({ data }: Props) {
  const { user } = useAuth();

  const myTeamIndex = data.leaderboard.findIndex(
    (entry) => entry.userId === user?.uid,
  );
  const myTeamRank = myTeamIndex >= 0 ? myTeamIndex + 1 : null;
  const myTeamScore =
    myTeamIndex >= 0 ? data.leaderboard[myTeamIndex].totalScore : null;

  const uniquePlayers = new Set<string>();
  for (const entry of data.leaderboard) {
    for (const ps of entry.playerScores) {
      if (ps.mastersId) uniquePlayers.add(ps.mastersId);
    }
  }

  return (
    <div className={styles.page}>
      <MastersHero
        currentRound={data.currentRound}
        status={data.status}
        myTeamRank={myTeamRank}
        myTeamScore={myTeamScore}
        fieldSize={data.leaders.length > 0 ? 91 : uniquePlayers.size}
      />

      <MastersTicker leaders={data.leaders} />

      <div className={styles.standings}>
        <div className={styles.standingsHeader}>
          Pool Standings
          <span className={styles.liveBadge}>
            {data.status === "active" ? "Live" : "Final"}
          </span>
        </div>
        {data.leaderboard.map((entry, idx) => (
          <MastersTeamCard
            key={entry.teamId}
            entry={entry}
            rank={idx + 1}
            holes={data.holes}
            roundPars={data.roundPars}
            currentRound={data.currentRound}
          />
        ))}
      </div>
    </div>
  );
}
