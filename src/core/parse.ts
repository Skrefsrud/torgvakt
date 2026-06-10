import type { ParsedListing } from "../shared/types";

const LD_JSON_RE = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g;

interface LdProduct {
  "@type"?: string | string[];
  sku?: string;
  name?: string;
  image?: string | string[];
  offers?: { price?: string | number; availability?: string };
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

function toPrice(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw.replace(/[\s  ]/g, ""));
  return Number.isFinite(n) ? n : null;
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
    const avail = p.offers?.availability ?? "";
    return {
      id: p.sku ?? "",
      title: p.name ?? "",
      image: Array.isArray(p.image) ? p.image[0] ?? "" : p.image ?? "",
      price: toPrice(p.offers?.price),
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
