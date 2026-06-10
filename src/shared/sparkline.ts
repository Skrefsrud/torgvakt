import type { PricePoint } from "./types";

/**
 * Step path, time-proportional: a price holds flat until the seller changes it,
 * then jumps. The last price extends to "now" (right edge). A diagonal line
 * would suggest gradual movement that never happened.
 */
export function sparklinePath(
  history: PricePoint[],
  w = 120,
  h = 32,
  pad = 2,
  now = history[history.length - 1]?.ts ?? 0,
): string {
  if (history.length === 0) return "";
  const mid = (h / 2).toFixed(1);
  if (history.length === 1) return `M${pad.toFixed(1)},${mid} L${(w - pad).toFixed(1)},${mid}`;
  const t0 = history[0].ts;
  const span = Math.max(now - t0, 1);
  const prices = history.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const priceSpan = max - min || 1;
  const x = (ts: number) => (pad + (w - 2 * pad) * Math.min((ts - t0) / span, 1)).toFixed(1);
  const y = (price: number) => (pad + (h - 2 * pad) * (1 - (price - min) / priceSpan)).toFixed(1);
  let d = `M${x(history[0].ts)},${y(history[0].price)}`;
  for (let i = 1; i < history.length; i++) {
    d += ` H${x(history[i].ts)} V${y(history[i].price)}`;
  }
  d += ` H${(w - pad).toFixed(1)}`;
  return d;
}

/** Plot coordinates for each change point (for dots). Mirrors sparklinePath. */
export function sparklinePoints(
  history: PricePoint[],
  w = 120,
  h = 32,
  pad = 2,
  now = history[history.length - 1]?.ts ?? 0,
): { x: number; y: number }[] {
  if (history.length === 0) return [];
  if (history.length === 1) return [{ x: pad, y: h / 2 }];
  const t0 = history[0].ts;
  const span = Math.max(now - t0, 1);
  const prices = history.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const priceSpan = max - min || 1;
  return history.map((p) => ({
    x: pad + (w - 2 * pad) * Math.min((p.ts - t0) / span, 1),
    y: pad + (h - 2 * pad) * (1 - (p.price - min) / priceSpan),
  }));
}
