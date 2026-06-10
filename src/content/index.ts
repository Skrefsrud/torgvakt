import { parseListingHtml } from "../core/parse";
import { canTrack } from "../core/limits";
import { getTracked, trackListing, untrackListing } from "../shared/storage";
import type { ParsedListing, TrackedListing } from "../shared/types";
import { findPriceElement } from "./dom";
import { renderInlineHistory } from "./inline";

// The button often lands inside finn's shadow roots where content-script CSS
// cannot reach, so all injected elements are styled inline.
const BTN_BASE =
  "font:600 14px/1 system-ui,sans-serif;color:#16181d;border:none;border-radius:8px;" +
  "padding:8px 14px;margin:8px 0;cursor:pointer;display:block;";
const BTN_FLOAT =
  "position:fixed;right:16px;bottom:16px;z-index:99999;box-shadow:0 2px 8px rgba(0,0,0,0.35);";

async function main(): Promise<void> {
  const parsed = parseListingHtml(document.documentElement.outerHTML);
  if (!parsed || !parsed.id || parsed.price === null) return;
  const tracked = await getTracked();
  renderButton(parsed, parsed.id in tracked);
  const existing = tracked[parsed.id];
  if (existing) renderInlineHistory(existing);
}

function renderButton(parsed: ParsedListing, isTracked: boolean): void {
  const btn = document.createElement("button");
  btn.id = "torgvakt-btn";
  btn.type = "button";
  const anchor = findPriceElement(document);
  btn.style.cssText = anchor ? BTN_BASE : BTN_BASE + BTN_FLOAT;
  setLabel(btn, isTracked);
  btn.addEventListener("click", () => void toggle(parsed, btn));
  if (anchor) anchor.insertAdjacentElement("afterend", btn);
  else document.body.appendChild(btn);

}

function setLabel(btn: HTMLButtonElement, isTracked: boolean): void {
  btn.textContent = isTracked ? "Følges ✓" : "Følg pris";
  btn.style.background = isTracked ? "#c7cdd8" : "#e8b13f";
}

async function toggle(parsed: ParsedListing, btn: HTMLButtonElement): Promise<void> {
  const tracked = await getTracked();
  if (parsed.id in tracked) {
    await untrackListing(parsed.id);
    setLabel(btn, false);
    if (btn.nextElementSibling?.id === "torgvakt-history") btn.nextElementSibling.remove();
    return;
  }
  if (!canTrack(Object.keys(tracked).length)) {
    btn.textContent = "Gratisgrense nådd";
    return;
  }
  const listing: TrackedListing = {
    id: parsed.id,
    url: `${location.origin}${location.pathname}`,
    title: parsed.title,
    image: parsed.image,
    addedAt: Date.now(),
    status: "active",
    history: [{ ts: Date.now(), price: parsed.price as number }],
  };
  await trackListing(listing);
  setLabel(btn, true);
  renderInlineHistory(listing);
}

void main();
