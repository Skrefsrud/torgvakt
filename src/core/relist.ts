import type { SearchItem } from "./searchParse";

// Conservative on purpose: adopting the wrong listing corrupts price history.
const MIN_SIMILARITY = 0.5;
const PRICE_RANGE: [number, number] = [0.4, 1.4];
const STOPWORDS = new Set([
  "selges", "pent", "brukt", "helt", "som", "til", "med", "og", "for", "str",
  "billig", "rimelig", "nesten", "veldig",
]);
// "billig"/"rimelig" are noise for matching but fine in search queries, so the
// query builder uses a smaller stopword set.
const QUERY_STOPWORDS = new Set(["selges", "pent", "brukt", "helt", "som", "til", "med", "og", "for", "str"]);

export function tokens(title: string, stop: Set<string> = STOPWORDS): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9æøåäöü]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !stop.has(t));
}

/** Dice coefficient over informative title tokens. */
export function titleSimilarity(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return (2 * shared) / (ta.size + tb.size);
}

/** Search query for finding a relisted ad: the longest informative tokens. */
export function buildSearchQuery(title: string, maxTokens = 4): string {
  return [...new Set(tokens(title, QUERY_STOPWORDS))]
    .sort((a, b) => b.length - a.length)
    .slice(0, maxTokens)
    .join(" ");
}

export interface LostListing {
  id: string;
  title: string;
  lastPrice: number;
}

export function findRelistMatch(lost: LostListing, candidates: SearchItem[]): SearchItem | null {
  let best: SearchItem | null = null;
  let bestSim = 0;
  const lostTokens = new Set(tokens(lost.title));
  for (const c of candidates) {
    if (c.id === lost.id) continue;
    if (c.price < lost.lastPrice * PRICE_RANGE[0] || c.price > lost.lastPrice * PRICE_RANGE[1]) continue;
    const sim = titleSimilarity(lost.title, c.title);
    if (sim < MIN_SIMILARITY) continue;
    let shared = 0;
    for (const t of tokens(c.title)) if (lostTokens.has(t)) shared++;
    if (shared < 2 && sim < 1) continue;
    if (sim > bestSim) {
      best = c;
      bestSim = sim;
    }
  }
  return best;
}
