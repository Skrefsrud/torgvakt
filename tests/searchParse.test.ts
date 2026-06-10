import { readFileSync } from "node:fs";
import { parseSearchHtml } from "../src/core/searchParse";

const searchHtml = readFileSync("tests/fixtures/search-results.html", "utf-8");

test("parses items from real search results page", () => {
  const items = parseSearchHtml(searchHtml);
  expect(items.length).toBeGreaterThan(40);
  const first = items[0];
  expect(first.id).toBe("466564665");
  expect(first.title).toBe("TRIACLE SYKKEL");
  expect(first.price).toBe(500);
  expect(first.url).toContain("/recommerce/forsale/item/466564665");
  expect(first.image).toContain("finncdn.no");
});

test("skips items without parsable price or id", () => {
  const html = `<script type="application/ld+json">{"@type":"CollectionPage","mainEntity":{"@type":"ItemList","itemListElement":[
    {"@type":"ListItem","item":{"@type":"Product","name":"Uten pris","url":"https://www.finn.no/recommerce/forsale/item/1"}},
    {"@type":"ListItem","item":{"@type":"Product","name":"Uten url","offers":{"price":"100"}}},
    {"@type":"ListItem","item":{"@type":"Product","name":"OK","offers":{"price":"100"},"url":"https://www.finn.no/recommerce/forsale/item/2"}}
  ]}}</script>`;
  const items = parseSearchHtml(html);
  expect(items).toHaveLength(1);
  expect(items[0].id).toBe("2");
});

test("returns empty array on garbage", () => {
  expect(parseSearchHtml("<html>nei</html>")).toEqual([]);
});
