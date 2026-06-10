import { stripFinnSuffix, toPrice } from "../core/parse";
import type { ParsedListing } from "../shared/types";

// \s in JS regex covers nbsp (u00a0) and narrow nbsp (u202f), which finn uses in prices
const PRICE_RE = /^\d[\d\s]*kr$/;

/**
 * Some finn SSR variants put price data only inside shadow-rooted hydration
 * scripts, which outerHTML cannot see. The DOM itself still shows the price,
 * so build the listing from URL id + visible price + document title.
 */
export function domFallbackListing(
  urlId: string,
  priceText: string | null,
  docTitle: string,
): ParsedListing | null {
  if (!urlId || !priceText) return null;
  const price = toPrice(priceText.replace(/kr/gi, "").trim());
  if (price === null) return null;
  return { id: urlId, title: stripFinnSuffix(docTitle), image: "", price, availability: "unknown" };
}
const CANDIDATE_TAGS = new Set(["SPAN", "P", "DIV", "H2", "H3"]);

// finn.no renders the listing UI inside declarative shadow roots, so a plain
// querySelectorAll never sees the price. Walk open shadow roots too.
function* walk(root: ParentNode): Generator<Element> {
  for (const el of root.querySelectorAll("*")) {
    yield el;
    if (el.shadowRoot) yield* walk(el.shadowRoot);
  }
}

export function findPriceElement(doc: Document): Element | null {
  for (const el of walk(doc)) {
    if (!CANDIDATE_TAGS.has(el.tagName)) continue;
    if (el.children.length === 0 && PRICE_RE.test(el.textContent?.trim() ?? "")) return el;
  }
  return null;
}

const DISPOSED_WORDS = new Set(["solgt", "utløpt", "inaktiv", "fjernet", "slettet"]);

/**
 * Sold/expired pages show a badge--warning element ("Solgt") in shadow DOM.
 * The disposed hydration marker is invisible to outerHTML, so the visible
 * badge is the reliable client-side signal.
 */
export function findDisposedBadge(doc: Document): string | null {
  for (const el of walk(doc)) {
    if (el.children.length > 0) continue;
    if (!/badge--warning/.test(el.className?.toString() ?? "")) continue;
    const text = el.textContent?.trim() ?? "";
    if (DISPOSED_WORDS.has(text.toLowerCase())) return text;
  }
  return null;
}
