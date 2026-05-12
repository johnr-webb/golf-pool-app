# Golf Pool App - Scoring System

## Overview

The app implements a **best-N-of-M** scoring system with **missed-cut penalty**, commonly used in golf pools.

## Scoring Rules

### 1. Best-N-of-M
Each team picks M golfers, but only the best N scores count toward the team's total.

**Example**: 4-of-6 pick system
```
Team picks: Scheffler (-10), Rahm (-8), McIlroy (-5), Morikawa (-3), Hovland (+2), Finau (+4)
Counting:   Scheffler (-10), Rahm (-8), McIlroy (-5), Morikawa (-3)
Non-counting: Hovland (+2), Finau (+4)

Team Total = -10 + -8 + -5 + -3 = -26
```

Lower score = better (standard golf scoring).

### 2. Missed-Cut Penalty
Any picked player who missed the cut is assigned the **worst score among players who made the cut**.

**Why?** Prevents punishing teams who picked hot players who simply didn't play well that week.

**Implementation** (`services/leaderboard.ts`):
```typescript
function applyMissedCutPenalty(scoreMap: Map<string, number | null>): Map<string, number> {
  // Find players who made the cut (score !== null, not cut)
  const cutMadeScores = [...scoreMap.values()].filter(s => s !== null);
  
  // Find worst score among cut-makers
  const worstCutScore = Math.max(...cutMadeScores);
  
  // Assign worst cut score to all missed-cut players
  for (const [playerId, score] of scoreMap) {
    if (score === null) {
      scoreMap.set(playerId, worstCutScore);  // Penalty
    }
  }
  
  return scoreMap as Map<string, number>;
}
```

### 3. Tiebreakers
Teams with equal scores share the same rank. The next rank is skipped (standard competition ranking).

---

## Score Parsing

ESPN returns scores as strings: `-14`, `+2`, `E` (even par).

```typescript
parseScore('-14')  // → -14
parseScore('+2')   // → 2
parseScore('E')    // → 0
parseScore('CUT')  // → null (missed cut)
parseScore('WD')   // → null (withdrew)
parseScore('DQ')   // → null (disqualified)
```

---

## Tier Validation

Pool creators define tiers based on odds ranges. Picks must satisfy all tier requirements:

```typescript
interface TierConfig {
  tierNumber: number;
  oddsMin: string;      // '+100'
  oddsMax: string;      // '+500'
  picksRequired: number;
}

function validatePicks(picks: Player[], tiers: TierConfig[]): ValidationResult {
  for (const tier of tiers) {
    const tierPicks = picks.filter(p => oddsInRange(p.odds, tier.oddsMin, tier.oddsMax));
    if (tierPicks.length !== tier.picksRequired) {
      return { valid: false, error: `Tier ${tier.tierNumber} requires ${tier.picksRequired} picks` };
    }
  }
  return { valid: true };
}
```

---

## Leaderboard Response

When tournament is `active` or `completed`:

```typescript
interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  userId: string;
  totalScore: number;  // Sum of counting scores
  playerScores: PlayerScore[];
}

interface PlayerScore {
  playerId: string;
  playerName: string;
  score: number | null;   // null if not started
  missedCut: boolean;
  counting: boolean;        // Whether this score counts toward team total
}
```

---

## Masters.com Scoring

For tournaments with `mastersYear` field, the app fetches from masters.com:

1. **Client-side scoring**: Leaderboard calculated in browser
2. **Auto-refetch**: Every 30 seconds during active tournament
3. **Hole-by-hole**: Detailed scorecard available

**Advantages**:
- Real-time updates without server load
- Rich hole-by-hole data
- Official Augusta National data

---

## Edge Cases

### All Players Miss Cut
If all picked players missed the cut, all get the same penalty (worst cut-made score in tournament).

### Player Withdraws (WD)
Treated like missed cut - assigned worst cut-made score.

### Disqualified (DQ)
Treated like missed cut - assigned worst cut-made score.

### Tournament Not Started
Returns empty leaderboard with team info only.

### Tournament Completed
Final scores remain frozen. No further updates.

---

## Code References

| File | Functions |
|------|-----------|
| `services/leaderboard.ts` | `parseScore`, `applyMissedCutPenalty`, `calculateTeamScore` |
| `services/validation.ts` | `parseOdds`, `isInTier`, `validatePicks` |
| `web/lib/masters/scoring.ts` | Client-side scoring port |
| `web/lib/validation/tiers.ts` | Client-side tier validation |
