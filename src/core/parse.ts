import type { ParsedListing } from "../shared/types";

const LD_JSON_RE = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g;

type LdImage = string | { url?: string; contentUrl?: string };

export interface LdOffer {
  price?: string | number;
  availability?: string;
}

interface LdProduct {
  "@type"?: string | string[];
  sku?: string;
  name?: string;
  image?: LdImage | LdImage[];
  offers?: LdOffer | LdOffer[];
}

// offers may be a single object or an array (both valid schema.org)
export function firstOffer(raw: LdOffer | LdOffer[] | undefined): LdOffer | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

// Torget uses plain URL strings; mobility uses ImageObject (sometimes arrays of either).
function toImage(raw: LdImage | LdImage[] | undefined): string {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first === "string") return first;
  return first?.contentUrl ?? first?.url ?? "";
}

function findProduct(node: unknown): LdProduct | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const p = findProduct(n);
      if (p) return p;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) {
    return obj as LdProduct;
  }
  return findProduct(obj["@graph"]);
}

// Handles "500", 43000, "1 234", "43.000" (dotted thousands), "1.234,56"
// (Norwegian decimal comma).
export function toPrice(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = raw.replace(/[\s\u00a0\u202f]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Expired/sold listings return HTTP 200 without Product JSON-LD; the hydration
// payload carries disposed:true (sometimes escaped inside a JSON string).
// Scoped to the hydration block around the listing's OWN adId: pages embed other
// listings (recommendations), so a global scan could be poisoned.
const DISPOSED_RE = /\\?"disposed\\?":\s*true/;
const DISPOSED_TEXT_RE = /\\?"disposedText\\?":\s*\\?"([^"\\]+)\\?"/;
const SCOPE = 3000;

export function parseDisposed(html: string, id: string): { disposed: true; text: string } | null {
  const idMatch = new RegExp(`\\\\?"adId\\\\?":\\\\?"?${id}`).exec(html);
  if (!idMatch) return null;
  const window = html.slice(Math.max(0, idMatch.index - SCOPE), idMatch.index + SCOPE);
  if (!DISPOSED_RE.test(window)) return null;
  const text = window.match(DISPOSED_TEXT_RE)?.[1] ?? "";
  return { disposed: true, text };
}

export function parseListingHtml(html: string): ParsedListing | null {
  for (const m of html.matchAll(LD_JSON_RE)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const p = findProduct(data);
    if (!p) continue;
    const offer = firstOffer(p.offers);
    const avail = offer?.availability ?? "";
    return {
      id: p.sku ?? "",
      title: p.name ?? "",
      image: toImage(p.image),
      price: toPrice(offer?.price),
      availability: avail.includes("InStock")
        ? "InStock"
        : avail.includes("SoldOut") || avail.includes("OutOfStock")
          ? "SoldOut"
          : "unknown",
    };
  }
  const og = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/);
  if (og) return { id: "", title: og[1], image: "", price: null, availability: "unknown" };
  return null;
}
