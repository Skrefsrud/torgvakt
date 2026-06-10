import { formatPrice, priceChange } from "../core/history";
import { sparklinePath } from "../shared/sparkline";
import type { ListingStatus, TrackedListing } from "../shared/types";

export function statusLabel(status: ListingStatus): string {
  return { active: "", sold: "Solgt", removed: "Fjernet", parseError: "Lesefeil" }[status];
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function renderListingItem(l: TrackedListing): string {
  const current = l.history[l.history.length - 1];
  const change = priceChange(l.history);
  const changeHtml = change
    ? `<span class="tv-change ${change.abs < 0 ? "tv-down" : "tv-up"}">${change.abs < 0 ? "-" : "+"}${Math.abs(change.abs).toLocaleString("nb-NO").replace(/[\u00a0\u202f]/g, " ")} kr (${change.pct}%)</span>`
    : `<span class="tv-change">ingen endring</span>`;
  const badge = statusLabel(l.status);
  return `
  <li class="tv-item ${l.status !== "active" ? "tv-inactive" : ""}">
    ${l.image ? `<img src="${esc(l.image)}" alt="">` : `<div class="tv-noimg"></div>`}
    <div class="tv-mid">
      <a href="${esc(l.url)}" target="_blank" rel="noreferrer">${esc(l.title)}</a>
      <div class="tv-priceline">
        <strong>${formatPrice(current.price)}</strong>
        ${changeHtml}
        ${badge ? `<span class="tv-badge">${badge}</span>` : ""}
        ${l.relistedFrom?.length ? `<span class="tv-badge tv-relist">Lagt ut på nytt</span>` : ""}
      </div>
    </div>
    <svg viewBox="0 0 120 32" width="90" height="24" aria-hidden="true">
      <path d="${sparklinePath(l.history)}" fill="none" stroke="#e8b13f" stroke-width="2"/>
    </svg>
    <button class="tv-remove" data-id="${esc(l.id)}" title="Slutt å følge">✕</button>
  </li>`;
}
