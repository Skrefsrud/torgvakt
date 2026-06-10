import { formatPrice, priceChange } from "../core/history";
import { sparklinePath } from "../shared/sparkline";
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

  const prices = listing.history.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const change = priceChange(listing.history);
  const changeText = change
    ? `${change.abs < 0 ? "-" : "+"}${formatPrice(Math.abs(change.abs))} (${change.pct}%) siden du begynte å følge`
    : "Ingen prisendring registrert ennå";

  panel.innerHTML = `
    <div style="${TITLE_STYLE}">Torgvakt prishistorikk</div>
    <svg viewBox="0 0 120 32" width="240" height="64" aria-hidden="true">
      <path d="${sparklinePath(listing.history)}" fill="none" stroke="#e8b13f" stroke-width="2"/>
    </svg>
    <div style="${META_STYLE}">${changeText}</div>
    <div style="${META_STYLE}">Lavest: ${formatPrice(min)} / Høyest: ${formatPrice(max)} / ${listing.history.length} punkt</div>
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
