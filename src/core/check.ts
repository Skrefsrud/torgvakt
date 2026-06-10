import { appendIfChanged, formatPrice } from "./history";
import { parseDisposed, parseListingHtml } from "./parse";
import type { Settings, TrackedListing } from "../shared/types";

/**
 * Applies one fetch result to a tracked listing (mutates it).
 * Returns a notification message, or null when nothing should be shown.
 */
export function applyFetchResult(
  listing: TrackedListing,
  httpStatus: number,
  html: string | null,
  settings: Settings,
  now: number,
): string | null {
  if (httpStatus === 404 || httpStatus === 410) {
    listing.status = "removed";
    return settings.notifyAll ? "Annonsen er fjernet" : null;
  }
  if (httpStatus < 200 || httpStatus >= 300 || html === null) return null;

  // Disposed marker first: sold pages can still carry stale InStock JSON-LD.
  const disposed = parseDisposed(html, listing.id);
  if (disposed) {
    listing.status = /solgt/i.test(disposed.text) ? "sold" : "removed";
    return settings.notifyAll
      ? listing.status === "sold"
        ? "Annonsen er markert som solgt"
        : "Annonsen er fjernet"
      : null;
  }
  const parsed = parseListingHtml(html);
  if (!parsed) {
    listing.status = "parseError";
    return null;
  }
  if (parsed.availability === "SoldOut") {
    listing.status = "sold";
    return settings.notifyAll ? "Annonsen er markert som solgt" : null;
  }
  listing.status = "active";
  if (parsed.price === null) return null;

  const { history, changed, prev } = appendIfChanged(listing.history, parsed.price, now);
  listing.history = history;
  if (!changed || prev === null) return null;

  const drop = parsed.price < prev;
  if ((drop && settings.notifyDrops) || (!drop && settings.notifyAll)) {
    return `${drop ? "Pris ned" : "Pris opp"}: ${formatPrice(prev)} → ${formatPrice(parsed.price)}`;
  }
  return null;
}
