import { parseListingHtml } from "../core/parse";
import { canTrack } from "../core/limits";
import { getTracked, trackListing, untrackListing } from "../shared/storage";
import type { ParsedListing, TrackedListing } from "../shared/types";
import { findPriceElement } from "./dom";
import { renderInlineHistory } from "./inline";

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
  setLabel(btn, isTracked);
  btn.addEventListener("click", () => void toggle(parsed, btn));
  const anchor = findPriceElement(document);
  if (anchor) {
    btn.classList.add("torgvakt-inline");
    anchor.insertAdjacentElement("afterend", btn);
  } else {
    btn.classList.add("torgvakt-float");
    document.body.appendChild(btn);
  }
}

function setLabel(btn: HTMLButtonElement, isTracked: boolean): void {
  btn.textContent = isTracked ? "Følges ✓" : "Følg pris";
  btn.classList.toggle("torgvakt-active", isTracked);
}

async function toggle(parsed: ParsedListing, btn: HTMLButtonElement): Promise<void> {
  const tracked = await getTracked();
  if (parsed.id in tracked) {
    await untrackListing(parsed.id);
    setLabel(btn, false);
    document.getElementById("torgvakt-history")?.remove();
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
