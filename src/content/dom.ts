// \s in JS regex covers nbsp (u00a0) and narrow nbsp (u202f), which finn uses in prices
const PRICE_RE = /^\d[\d\s]*kr$/;

export function findPriceElement(doc: Document): Element | null {
  const root = doc.querySelector("main") ?? doc.body;
  for (const el of root.querySelectorAll("span, p, div, h2, h3")) {
    if (el.children.length === 0 && PRICE_RE.test(el.textContent?.trim() ?? "")) return el;
  }
  return null;
}
