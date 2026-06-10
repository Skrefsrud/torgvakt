import type { PricePoint } from "./types";

export function sparklinePath(history: PricePoint[], w = 120, h = 32, pad = 2): string {
  if (history.length === 0) return "";
  const mid = (h / 2).toFixed(1);
  if (history.length === 1) return `M${pad.toFixed(1)},${mid} L${(w - pad).toFixed(1)},${mid}`;
  const prices = history.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const stepX = (w - 2 * pad) / (history.length - 1);
  return history
    .map((p, i) => {
      const x = pad + i * stepX;
      const y = pad + (h - 2 * pad) * (1 - (p.price - min) / span);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
