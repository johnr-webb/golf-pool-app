"use client";

import { useState } from "react";
import type { MastersLeaderboardEntry, MastersHoleInfo } from "@/lib/masters/types";
import { formatScore } from "@/lib/utils/format";
import { MastersPlayerRow } from "./MastersPlayerRow";
import styles from "./masters.module.css";

const RANK_COLORS: Record<number, string> = {
  1: "#d4af37",
  2: "#C0C0C0",
  3: "#cd7f32",
};

interface Props {
  entry: MastersLeaderboardEntry;
  rank: number;
  holes: MastersHoleInfo[];
  roundPars: number[][];
  currentRound: number;
}

export function MastersTeamCard({ entry, rank, holes, roundPars, currentRound }: Props) {
  const [expanded, setExpanded] = useState(false);

  const rankColor = RANK_COLORS[rank] ?? "#555";

  return (
    <div className={styles.teamCard} data-rank={rank <= 3 ? rank : undefined}>
      <div className={styles.teamHeader} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className={styles.teamRank} style={{ background: rankColor }}>
            {rank}
          </div>
          <span className={styles.teamName}>{entry.teamName}</span>
        </div>
        <div className={styles.teamScore}>{formatScore(entry.totalScore)}</div>
      </div>
      {expanded &&
        entry.playerScores.map((player) => (
          <MastersPlayerRow
            key={player.playerId}
            player={player}
            holes={holes}
            roundPars={roundPars}
            currentRound={currentRound}
          />
        ))}
    </div>
  );
}
