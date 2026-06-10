import { readFileSync } from "node:fs";
import { parseListingHtml } from "../src/core/parse";
import { parseSearchHtml } from "../src/core/searchParse";
import { listingIdFromPath } from "../src/core/listingId";

const mcItem = readFileSync("tests/fixtures/listing-mc.html", "utf-8");
const mcSearch = readFileSync("tests/fixtures/search-mc.html", "utf-8");

test("parses MC listing JSON-LD (numeric price, no sku)", () => {
  const p = parseListingHtml(mcItem);
  expect(p).not.toBeNull();
  expect(p!.title).toBe("Honda CB 125 R");
  expect(p!.price).toBe(43000);
  expect(p!.availability).toBe("InStock");
  expect(p!.id).toBe(""); // mobility Products carry no sku; id comes from the URL
});

test("image is always a string, even for mobility ImageObject arrays", () => {
  const p = parseListingHtml(mcItem);
  expect(typeof p!.image).toBe("string");
  expect(p!.image).toContain("finncdn.no");
});

test("listingIdFromPath extracts id for both verticals", () => {
  expect(listingIdFromPath("/recommerce/forsale/item/466564665")).toBe("466564665");
  expect(listingIdFromPath("/mobility/item/465836254")).toBe("465836254");
  expect(listingIdFromPath("/recommerce/forsale/search")).toBe("");
});

test("parses MC search results with mobility item URLs", () => {
  const items = parseSearchHtml(mcSearch);
  expect(items.length).toBeGreaterThan(30);
  expect(items[0].id).toMatch(/^\d+$/);
  expect(items[0].url).toContain("/mobility/item/");
  expect(items[0].price).toBeGreaterThan(0);
});
