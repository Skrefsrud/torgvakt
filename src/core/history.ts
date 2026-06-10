import type { PricePoint } from "../shared/types";

export const MAX_POINTS = 500;

export function appendIfChanged(
  history: PricePoint[],
  price: number,
  ts: number,
): { history: PricePoint[]; changed: boolean; prev: number | null } {
  const last = history[history.length - 1];
  if (last && last.price === price) return { history, changed: false, prev: last.price };
  const next = [...history, { ts, price }].slice(-MAX_POINTS);
  return { history: next, changed: history.length > 0, prev: last ? last.price : null };
}

export function formatPrice(price: number): string {
  return `${price.toLocaleString("nb-NO").replace(/[\u00a0\u202f]/g, " ")} kr`;
}

export function priceChange(history: PricePoint[]): { abs: number; pct: number } | null {
  if (history.length < 2) return null;
  const first = history[0].price;
  const last = history[history.length - 1].price;
  const abs = last - first;
  return { abs, pct: first === 0 ? 0 : Math.round((abs / first) * 100) };
}
