import { formatPrice, priceChange } from "../core/history";
import { sparklinePath } from "../shared/sparkline";
import type { TrackedListing } from "../shared/types";

export function renderInlineHistory(listing: TrackedListing): void {
  document.getElementById("torgvakt-history")?.remove();
  const btn = document.getElementById("torgvakt-btn");
  if (!btn) return;

  const panel = document.createElement("div");
  panel.id = "torgvakt-history";

  const prices = listing.history.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const change = priceChange(listing.history);
  const changeText = change
    ? `${change.abs < 0 ? "" : "+"}${formatPrice(change.abs)} (${change.pct}%) siden du begynte å følge`
    : "Ingen prisendring registrert ennå";

  panel.innerHTML = `
    <div class="torgvakt-h-title">Torgvakt prishistorikk</div>
    <svg viewBox="0 0 120 32" width="240" height="64" aria-hidden="true">
      <path d="${sparklinePath(listing.history)}" fill="none" stroke="#e8b13f" stroke-width="2"/>
    </svg>
    <div class="torgvakt-h-meta">${changeText}</div>
    <div class="torgvakt-h-meta">Lavest: ${formatPrice(min)} / Høyest: ${formatPrice(max)} / ${listing.history.length} punkt</div>
  `;
  btn.insertAdjacentElement("afterend", panel);
}
