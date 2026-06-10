import { readFileSync } from "node:fs";
import { parseDisposed, parseListingHtml } from "../src/core/parse";
import { applyFetchResult } from "../src/core/check";
import type { Settings, TrackedListing } from "../src/shared/types";

const noProductLd = readFileSync("tests/fixtures/listing-no-product-ld.html", "utf-8");
const soldWithLd = readFileSync("tests/fixtures/listing-sold-with-ld.html", "utf-8");
const settings: Settings = { checkIntervalHours: 6, notifyDrops: true, notifyAll: false };

// D1: common finn SSR variant with no Product JSON-LD but hydration priceText
test("falls back to hydration payload (adId + priceText) when Product JSON-LD missing", () => {
  const p = parseListingHtml(noProductLd);
  expect(p).not.toBeNull();
  expect(p!.id).toBe("461484344");
  expect(p!.price).toBe(300);
  expect(p!.title).toBe("Togbillett Stavanger - Oslo S 29.4");
});

// D2: sold page whose JSON-LD still claims InStock; disposed marker must win
test("disposed marker wins over stale InStock JSON-LD in background checks", () => {
  const l: TrackedListing = {
    id: "466129966", url: "https://www.finn.no/recommerce/forsale/item/466129966",
    title: "Titleist Vokey Wedge Sett", image: "", addedAt: 1, status: "active",
    history: [{ ts: 1, price: 2000 }],
  };
  applyFetchResult(l, 200, soldWithLd, settings, 2);
  expect(l.status).toBe("sold");
  expect(l.history).toHaveLength(1);
});

test("parseDisposed detects the sold-with-ld variant", () => {
  expect(parseDisposed(soldWithLd, "466129966")?.disposed).toBe(true);
});

// D5: finn sometimes mangles emoji in JSON-LD name as literal \u{d83d}\u{dd25}
test("decodes mangled unicode escapes in titles", () => {
  const html = `<script type="application/ld+json">{"@type":"Product","sku":"1","name":"\\\\u{d83d}\\\\u{dd25}FORSEGLET!!","offers":{"price":"100"}}</script>`;
  expect(parseListingHtml(html)!.title).toBe("🔥FORSEGLET!!");
});

// D6: generic short JSON-LD name ("Andre") loses to the real og:title headline
test("prefers og:title over a generic short JSON-LD name", () => {
  const html = `<meta property="og:title" content="Yamaha XSR 700 2022 | FINN MC"><script type="application/ld+json">{"@type":"Product","sku":"1","name":"Andre","offers":{"price":"80000"}}</script>`;
  expect(parseListingHtml(html)!.title).toBe("Yamaha XSR 700 2022");
});

// D4 stays by design: "Gis bort" priceText yields no parsable price -> no tracking
test("free listings (Gis bort) remain untrackable by design", () => {
  const html = `<meta property="og:title" content="Gratis sofa | FINN-torget"><script>{"adId":"123","priceText":"Gis bort"}</script>`;
  const p = parseListingHtml(html);
  expect(p?.price ?? null).toBeNull();
});
