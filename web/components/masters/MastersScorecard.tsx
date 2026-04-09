"use client";

import { useState } from "react";
import type { MastersPlayerRound } from "@/lib/masters/types";
import { MastersScorecardCell } from "./MastersScorecardCell";
import styles from "./masters.module.css";

interface Props {
  rounds: MastersPlayerRound[];
  roundPars: number[][];
  currentRound: number;
}

export function MastersScorecard({ rounds, roundPars, currentRound }: Props) {
  const [selectedRound, setSelectedRound] = useState(currentRound - 1);

  const round = rounds[selectedRound];
  const pars = roundPars[selectedRound] ?? roundPars[0] ?? [];

  if (!round || pars.length === 0) {
    return null;
  }

  const front = round.scores.slice(0, 9);
  const back = round.scores.slice(9, 18);
  const frontPars = pars.slice(0, 9);
  const backPars = pars.slice(9, 18);

  const frontTotal = front.reduce<number>((s, v) => s + (v ?? 0), 0);
  const backTotal = back.reduce<number>((s, v) => s + (v ?? 0), 0);
  const frontPlayed = front.some((v) => v !== null);
  const backPlayed = back.some((v) => v !== null);

  return (
    <div className={styles.scorecard}>
      <div className={styles.roundTabs}>
        {rounds.map((r, i) => (
          <button
            key={i}
            className={`${styles.roundTab} ${i === selectedRound ? styles.roundTabActive : ""}`}
            onClick={() => setSelectedRound(i)}
          >
            R{i + 1}
          </button>
        ))}
      </div>

      {/* Front 9 */}
      <div style={{ overflowX: "auto" }}>
        <table className={styles.scorecardTable}>
          <tbody>
            <tr className={styles.holeNumberRow}>
              <td style={{ width: 8 }} />
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((h) => (
                <td key={h}>{h}</td>
              ))}
              <td className={styles.outInLabel}>OUT</td>
            </tr>
            <tr className={styles.scoreRow}>
              <td />
              {front.map((score, i) => (
                <td key={i}>
                  <MastersScorecardCell score={score} par={frontPars[i]} />
                </td>
              ))}
              <td className={styles.outInTotal}>
                {frontPlayed ? frontTotal : "—"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Back 9 */}
        <table className={styles.scorecardTable} style={{ marginTop: 4 }}>
          <tbody>
            <tr className={styles.holeNumberRow}>
              <td style={{ width: 8 }} />
              {[10, 11, 12, 13, 14, 15, 16, 17, 18].map((h) => (
                <td key={h}>{h}</td>
              ))}
              <td className={styles.outInLabel}>IN</td>
            </tr>
            <tr className={styles.scoreRow}>
              <td />
              {back.map((score, i) => (
                <td key={i}>
                  <MastersScorecardCell score={score} par={backPars[i]} />
                </td>
              ))}
              <td className={styles.outInTotal}>
                {backPlayed ? backTotal : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.legend}>
        <span>
          <span className={`${styles.legendDot} ${styles.cellEagle}`}>·</span>{" "}
          Eagle
        </span>
        <span>
          <span className={`${styles.legendDot} ${styles.cellBirdie}`}>·</span>{" "}
          Birdie
        </span>
        <span>
          <span className={`${styles.legendDot} ${styles.cellBogey}`}>·</span>{" "}
          Bogey+
        </span>
      </div>
    </div>
  );
}
