"use client";

import styles from "./masters.module.css";

interface Props {
  score: number | null;
  par: number;
}

export function MastersScorecardCell({ score, par }: Props) {
  if (score === null) {
    return <span className={styles.cellUnplayed}>·</span>;
  }

  const diff = score - par;

  if (diff <= -2) {
    return <span className={styles.cellEagle}>{score}</span>;
  }
  if (diff === -1) {
    return <span className={styles.cellBirdie}>{score}</span>;
  }
  if (diff === 1) {
    return <span className={styles.cellBogey}>{score}</span>;
  }
  if (diff >= 2) {
    return <span className={styles.cellDoubleBogey}>{score}</span>;
  }

  return <span>{score}</span>;
}
