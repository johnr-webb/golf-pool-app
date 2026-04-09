"use client";

import type { MastersLeader } from "@/lib/masters/types";
import { countryCodeToFlag } from "@/lib/masters/flags";
import styles from "./masters.module.css";

const POS_COLORS: Record<string, string> = {
  "1": "#d4af37",
  "2": "#C0C0C0",
  "3": "#cd7f32",
};

interface Props {
  leaders: MastersLeader[];
}

export function MastersTicker({ leaders }: Props) {
  if (leaders.length === 0) return null;

  return (
    <div className={styles.ticker}>
      <div className={styles.tickerScroll}>
        <div className={styles.tickerBadge}>Leaders</div>
        {leaders.map((leader, i) => {
          const posColor = POS_COLORS[leader.pos.replace("T", "")] ?? "#888";
          return (
            <div key={i} className={styles.tickerChip}>
              <span className={styles.tickerPos} style={{ color: posColor }}>
                {leader.pos}
              </span>
              <span className={styles.tickerFlag}>
                {countryCodeToFlag(leader.countryCode)}
              </span>
              <span className={styles.tickerName}>{leader.name}</span>
              <span className={styles.tickerScore}>{leader.score}</span>
              <span className={styles.tickerThru}>{leader.thru}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
