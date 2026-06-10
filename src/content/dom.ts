// \s in JS regex covers nbsp (u00a0) and narrow nbsp (u202f), which finn uses in prices
const PRICE_RE = /^\d[\d\s]*kr$/;
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
