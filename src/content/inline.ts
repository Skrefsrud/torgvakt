import { formatPrice, priceChange } from "../core/history";
import { CHART_VIEWBOX, priceChart } from "../shared/chart";
import type { TrackedListing } from "../shared/types";

// Inline styles: the panel can live inside finn's shadow roots where
// content-script CSS cannot reach.
const PANEL_STYLE =
  "font:12px/1.5 system-ui,sans-serif;color:#c7cdd8;background:#16181d;border-radius:8px;" +
  "padding:10px 12px;margin:4px 0 8px;max-width:280px;";
const TITLE_STYLE = "font-weight:700;color:#e8b13f;margin-bottom:4px;";
const META_STYLE = "margin-top:4px;";

export function renderInlineHistory(listing: TrackedListing): void {
  const btn = document.getElementById("torgvakt-btn") ?? findInShadow("torgvakt-btn");
  if (!btn) return;
  if (btn.nextElementSibling?.id === "torgvakt-history") btn.nextElementSibling.remove();

  const panel = document.createElement("div");
  panel.id = "torgvakt-history";
  panel.style.cssText = PANEL_STYLE;

  const change = priceChange(listing.history);
  const changeText = change
    ? `${change.abs < 0 ? "Prisen er satt ned" : "Prisen er satt opp"} ${formatPrice(Math.abs(change.abs))} (${change.pct}%) siden du begynte å følge`
    : "Ingen prisendring siden du begynte å følge";

  panel.innerHTML = `
    <div style="${TITLE_STYLE}">Torgvakt prishistorikk</div>
    <svg viewBox="${CHART_VIEWBOX}" width="264" height="96" aria-hidden="true">${priceChart(listing.history, Date.now())}</svg>
    <div style="${META_STYLE}">${changeText}</div>
  `;
  btn.insertAdjacentElement("afterend", panel);
}

function findInShadow(id: string): HTMLElement | null {
  const walk = (root: ParentNode): HTMLElement | null => {
    for (const el of root.querySelectorAll("*")) {
      if (el.id === id) return el as HTMLElement;
      if (el.shadowRoot) {
        const hit = walk(el.shadowRoot);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(document);
}
