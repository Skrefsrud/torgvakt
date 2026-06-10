import { readFileSync } from "node:fs";
import { parseListingHtml } from "../src/core/parse";

const active = readFileSync("tests/fixtures/listing-active.html", "utf-8");
const sold = readFileSync("tests/fixtures/listing-sold.html", "utf-8");
const noLd = readFileSync("tests/fixtures/listing-no-ldjson.html", "utf-8");

test("parses active listing JSON-LD", () => {
  const p = parseListingHtml(active);
  expect(p).not.toBeNull();
  expect(p!.id).toBe("466564665");
  expect(p!.title).toBe("TRIACLE SYKKEL");
  expect(p!.price).toBe(500);
  expect(p!.image).toContain("finncdn.no");
  expect(p!.availability).toBe("InStock");
});

test("detects sold listing", () => {
  expect(parseListingHtml(sold)!.availability).toBe("SoldOut");
});

test("falls back to og:title when JSON-LD missing", () => {
  const p = parseListingHtml(noLd);
  expect(p).not.toBeNull();
  expect(p!.title).toBe("Reservedel sykkel");
  expect(p!.price).toBeNull();
  expect(p!.id).toBe("");
});

test("returns null on garbage", () => {
  expect(parseListingHtml("<html><body>hei</body></html>")).toBeNull();
});

test("handles offers as an array (valid schema.org shape)", () => {
  const html = `<script type="application/ld+json">{"@type":"Product","sku":"7","name":"X","offers":[{"price":"750","availability":"https://schema.org/InStock"}]}</script>`;
  const p = parseListingHtml(html)!;
  expect(p.price).toBe(750);
  expect(p.availability).toBe("InStock");
});

test("parses Norwegian price formats: dotted thousands and decimal comma", () => {
  const mk = (price: string) =>
    `<script type="application/ld+json">{"@type":"Product","sku":"7","name":"X","offers":{"price":"${price}"}}</script>`;
  expect(parseListingHtml(mk("43.000"))!.price).toBe(43000);
  expect(parseListingHtml(mk("1.234,56"))!.price).toBe(1234.56);
  expect(parseListingHtml(mk("1 234"))!.price).toBe(1234);
  expect(parseListingHtml(mk("0"))!.price).toBe(0);
});

test("handles Product nested in @graph and array images", () => {
  const html = `<script type="application/ld+json">{"@graph":[{"@type":"Product","sku":"123","name":"X","image":["https://a/b.jpg"],"offers":{"price":"1 234","availability":"https://schema.org/InStock"}}]}</script>`;
  const p = parseListingHtml(html)!;
  expect(p.id).toBe("123");
  expect(p.image).toBe("https://a/b.jpg");
  expect(p.price).toBe(1234);
});
