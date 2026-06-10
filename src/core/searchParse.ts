export interface SearchItem {
  id: string;
  title: string;
  price: number;
  image: string;
  url: string;
}

import { ITEM_PATH_RE } from "./listingId";

const LD_JSON_RE = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g;

interface LdListItem {
  item?: {
    name?: string;
    url?: string;
    image?: string | string[];
    offers?: { price?: string | number };
  };
}

function toPrice(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw.replace(/[\s  ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Extracts listing candidates from a finn.no search results page. */
export function parseSearchHtml(html: string): SearchItem[] {
  for (const m of html.matchAll(LD_JSON_RE)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const obj = data as { "@type"?: string; mainEntity?: { itemListElement?: LdListItem[] } };
    if (obj["@type"] !== "CollectionPage") continue;
    const elements = obj.mainEntity?.itemListElement ?? [];
    const items: SearchItem[] = [];
    for (const el of elements) {
      const p = el.item;
      if (!p?.url || !p.name) continue;
      const idMatch = p.url.match(ITEM_PATH_RE);
      const price = toPrice(p.offers?.price);
      if (!idMatch || price === null) continue;
      items.push({
        id: idMatch[1],
        title: p.name,
        price,
        image: Array.isArray(p.image) ? p.image[0] ?? "" : p.image ?? "",
        url: p.url,
      });
    }
    return items;
  }
  return [];
}
