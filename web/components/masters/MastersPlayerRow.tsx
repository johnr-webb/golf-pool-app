"use client";

import { useState } from "react";
import type { MastersPlayerScore, MastersHoleInfo } from "@/lib/masters/types";
import { countryCodeToFlag } from "@/lib/masters/flags";
import { formatScore } from "@/lib/utils/format";
import { MastersScorecard } from "./MastersScorecard";
import styles from "./masters.module.css";

interface Props {
  player: MastersPlayerScore;
  holes: MastersHoleInfo[];
  roundPars: number[][];
  currentRound: number;
}

export function MastersPlayerRow({ player, holes, roundPars, currentRound }: Props) {
  const [expanded, setExpanded] = useState(false);

  const flag = player.bio ? countryCodeToFlag(player.bio.countryCode) : "";
  const thruNum = player.thru ? parseInt(player.thru, 10) : NaN;
  const hasStarted = !isNaN(thruNum) && thruNum > 0;
  const isFinished = player.thru === "F" || thruNum >= 18;
  // "Thru 8" means 8 holes done, currently on hole 9
  const onHole = hasStarted && !isFinished ? thruNum + 1 : null;
  const currentHoleInfo =
    onHole && onHole <= holes.length ? holes[onHole - 1] : null;

  const scoreColor = (player.score ?? 0) < 0 ? "#4ade80" : (player.score ?? 0) > 0 ? "#dc2626" : "#ddd";

  if (expanded) {
    return (
      <div>
        <div className={styles.expandedHeader} onClick={() => setExpanded(false)}>
          <span className={styles.expandedFlag}>{flag}</span>
          <div style={{ flex: 1 }}>
            <div className={styles.expandedName}>{player.playerName}</div>
            <div className={styles.expandedBio}>
              {player.bio && (
                <>
                  {player.bio.age && `${player.bio.age}`}
                  {player.bio.height && ` · ${player.bio.height}`}
                  {player.bio.pastChampion && (
                    <span className={styles.championBadge}> · Past Champion</span>
                  )}
                  {player.bio.amateur && " · Amateur"}
                  {player.bio.firstMasters && " · First Masters"}
                </>
              )}
            </div>
          </div>
          <div className={styles.expandedScoreBlock}>
            <div className={styles.expandedTotal} style={{ color: scoreColor }}>
              {formatScore(player.score)}
            </div>
            <div className={styles.expandedPos}>
              {player.pos ?? ""} · Today {player.today ?? "—"}
            </div>
          </div>
        </div>
        {player.rounds.length > 0 && (
          <MastersScorecard
            rounds={player.rounds}
            roundPars={roundPars}
            currentRound={currentRound}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`${styles.playerRow} ${!player.counting ? styles.nonCounting : ""}`}
      onClick={() => setExpanded(true)}
    >
      <span className={styles.playerFlag}>{flag}</span>
      <div className={styles.playerInfo}>
        <div className={styles.playerName}>{player.playerName}</div>
        <div className={styles.playerHole}>
          {currentHoleInfo ? (
            <>
              Hole {currentHoleInfo.number} ·{" "}
              <span className={styles.playerHoleName}>
                {currentHoleInfo.name}, Par {currentHoleInfo.par}
              </span>
            </>
          ) : isFinished ? (
            "Finished"
          ) : hasStarted ? (
            `Thru ${player.thru}`
          ) : (
            ""
          )}
        </div>
      </div>
      <div className={styles.playerScoreBlock}>
        <div className={styles.playerTotal} style={{ color: scoreColor }}>
          {formatScore(player.score)}
        </div>
        <div className={styles.playerToday}>Today {player.today ?? "—"}</div>
      </div>
      <span className={styles.playerChevron}>▼</span>
    </div>
  );
}
