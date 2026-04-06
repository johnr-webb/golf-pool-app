import fetch from "node-fetch";
import { normalizeName } from "./espn";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4/sports";

interface OddsOutcome {
  name: string;
  price: number;
}

interface OddsBookmaker {
  key: string;
  title: string;
  markets: {
    key: string;
    outcomes: OddsOutcome[];
  }[];
}

interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  bookmakers: OddsBookmaker[];
}

export interface PlayerOddsResult {
  name: string;
  normalizedName: string;
  odds: string; // "+550" format
  medianPrice: number;
  bookmakerCount: number;
}

/**
 * Fetch outright odds from the-odds-api for a given sport key.
 */
export async function fetchOdds(
  sportKey: string,
  apiKey: string,
): Promise<OddsEvent[]> {
  const url =
    `${ODDS_API_BASE}/${sportKey}/odds/?apiKey=${apiKey}` +
    `&regions=us&markets=outrights&oddsFormat=american`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Odds API returned ${res.status}: ${body}`);
  }
  return (await res.json()) as OddsEvent[];
}

/**
 * Aggregate odds across bookmakers for each player.
 * Takes the median price to reduce outlier impact.
 */
export function aggregateOdds(events: OddsEvent[]): PlayerOddsResult[] {
  if (events.length === 0) return [];

  // Collect all prices per player name across all bookmakers
  const pricesByName = new Map<string, number[]>();

  for (const event of events) {
    for (const bookmaker of event.bookmakers) {
      const outrights = bookmaker.markets.find((m) => m.key === "outrights");
      if (!outrights) continue;

      for (const outcome of outrights.outcomes) {
        const existing = pricesByName.get(outcome.name) ?? [];
        existing.push(outcome.price);
        pricesByName.set(outcome.name, existing);
      }
    }
  }

  // Compute median and format
  const results: PlayerOddsResult[] = [];
  for (const [name, prices] of pricesByName) {
    prices.sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    const median =
      prices.length % 2 === 0
        ? Math.round((prices[mid - 1] + prices[mid]) / 2)
        : prices[mid];

    results.push({
      name,
      normalizedName: normalizeName(name),
      odds: `+${median}`,
      medianPrice: median,
      bookmakerCount: prices.length,
    });
  }

  // Sort by odds (favorites first)
  results.sort((a, b) => a.medianPrice - b.medianPrice);
  return results;
}
