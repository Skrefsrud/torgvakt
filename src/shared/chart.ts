import { formatPrice } from "../core/history";
import { sparklinePath, sparklinePoints } from "./sparkline";
import type { PricePoint } from "./types";

const MONTHS = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];

export function formatDateShort(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`;
}

// Layout: left gutter for kr labels, bottom gutter for date anchors.
const W = 264;
const H = 96;
const GUTTER_L = 52;
const GUTTER_B = 18;
const PAD = 6;
const PLOT_W = W - GUTTER_L;
const PLOT_H = H - GUTTER_B;

const LABEL = `fill="#9aa3b2" font-family="system-ui,sans-serif" font-size="11"`;

/**
 * Readable price history for non-technical users: a step line with a dot per
 * change, anchored by max/min prices on the left and the date range below.
 * Returns SVG inner markup for a viewBox of 0 0 264 96.
 */
export function priceChart(history: PricePoint[], now: number): string {
  if (history.length === 0) return "";
  const prices = history.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  const path = sparklinePath(history, PLOT_W, PLOT_H, PAD, now);
  const dots = sparklinePoints(history, PLOT_W, PLOT_H, PAD, now)
    .map(
      (pt) =>
        `<circle cx="${(GUTTER_L + pt.x).toFixed(1)}" cy="${pt.y.toFixed(1)}" r="3" fill="#e8b13f" stroke="#16181d" stroke-width="1.5"/>`,
    )
    .join("");

  const maxLabel = `<text x="${GUTTER_L - 8}" y="${PAD + 10}" text-anchor="end" ${LABEL}>${formatPrice(max)}</text>`;
  const minLabel =
    min === max
      ? ""
      : `<text x="${GUTTER_L - 8}" y="${PLOT_H - PAD + 3}" text-anchor="end" ${LABEL}>${formatPrice(min)}</text>`;
  const startLabel = `<text x="${GUTTER_L}" y="${H - 4}" ${LABEL}>${formatDateShort(history[0].ts)}</text>`;
  const endLabel = `<text x="${W - 2}" y="${H - 4}" text-anchor="end" ${LABEL}>i dag</text>`;

  return (
    `<g transform="translate(${GUTTER_L},0)"><path d="${path}" fill="none" stroke="#e8b13f" stroke-width="2"/></g>` +
    dots +
    maxLabel +
    minLabel +
    startLabel +
    endLabel
  );
}

export const CHART_VIEWBOX = `0 0 ${W} ${H}`;
