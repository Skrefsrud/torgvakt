// Matches both verticals: Torget (/recommerce/forsale/item/) and mobility (/mobility/item/).
// Mobility Product JSON-LD carries no sku, so the URL is the canonical id source there.
export const ITEM_PATH_RE = /\/(?:recommerce\/forsale|mobility)\/item\/(\d+)/;

export function listingIdFromPath(path: string): string {
  return path.match(ITEM_PATH_RE)?.[1] ?? "";
}
