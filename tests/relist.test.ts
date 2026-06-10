import { buildSearchQuery, findRelistMatch, titleSimilarity } from "../src/core/relist";
import type { SearchItem } from "../src/core/searchParse";

const item = (id: string, title: string, price: number): SearchItem => ({
  id, title, price, image: "", url: `https://www.finn.no/recommerce/forsale/item/${id}`,
});

test("titleSimilarity: identical titles = 1, disjoint = 0", () => {
  expect(titleSimilarity("Kona El Kahuna elsykkel", "Kona El Kahuna elsykkel")).toBe(1);
  expect(titleSimilarity("Kona elsykkel", "Sofa skinn")).toBe(0);
});

test("titleSimilarity ignores stopwords and short tokens", () => {
  expect(titleSimilarity("Pent brukt Kona elsykkel selges", "Kona elsykkel")).toBe(1);
});

test("buildSearchQuery picks the longest informative tokens", () => {
  expect(buildSearchQuery("Pent brukt Kona El Kahuna elsykkel selges billig")).toBe("elsykkel kahuna billig kona");
});

test("finds relisted item with similar title and lower price", () => {
  const lost = { id: "1", title: "Kona El Kahuna elsykkel 2022", lastPrice: 10900 };
  const match = findRelistMatch(lost, [
    item("2", "Helt annen sofa", 10900),
    item("3", "Kona El Kahuna elsykkel", 9500),
    item("4", "Elsykkel", 9000),
  ]);
  expect(match?.id).toBe("3");
});

test("excludes the old id itself", () => {
  const lost = { id: "1", title: "Kona elsykkel", lastPrice: 1000 };
  expect(findRelistMatch(lost, [item("1", "Kona elsykkel", 1000)])).toBeNull();
});

test("rejects price far outside plausible relist range", () => {
  const lost = { id: "1", title: "Kona El Kahuna elsykkel", lastPrice: 10000 };
  expect(findRelistMatch(lost, [item("2", "Kona El Kahuna elsykkel", 2000)])).toBeNull();
  expect(findRelistMatch(lost, [item("3", "Kona El Kahuna elsykkel", 25000)])).toBeNull();
});

test("keeps digit-bearing short tokens: iPhone 13 never matches iPhone 14", () => {
  expect(titleSimilarity("iPhone 13", "iPhone 14")).toBeLessThan(1);
  const lost = { id: "1", title: "iPhone 13", lastPrice: 4000 };
  expect(findRelistMatch(lost, [item("2", "iPhone 14", 4000)])).toBeNull();
});

test("conflicting digit tokens veto a match even with high similarity", () => {
  const lost = { id: "1", title: "iPhone 13 128GB", lastPrice: 4000 };
  expect(findRelistMatch(lost, [item("2", "iPhone 14 128GB", 4000)])).toBeNull();
  // same model relisted: digits agree, match allowed
  expect(findRelistMatch(lost, [item("3", "iPhone 13 128GB pent", 3800)])?.id).toBe("3");
});

test("dropping a year from the title does not veto (no conflicting digits)", () => {
  const lost = { id: "1", title: "Kona El Kahuna elsykkel 2022", lastPrice: 10000 };
  expect(findRelistMatch(lost, [item("2", "Kona El Kahuna elsykkel", 9500)])?.id).toBe("2");
});

test("requires at least two shared tokens unless similarity is perfect", () => {
  const lost = { id: "1", title: "Kona El Kahuna elsykkel rask", lastPrice: 1000 };
  // only one shared informative token ("elsykkel"), similarity < 1 -> no match
  expect(findRelistMatch(lost, [item("2", "DBS elsykkel gammel", 1000)])).toBeNull();
  // single-token title with perfect similarity -> match
  const lostSingle = { id: "1", title: "Garmin", lastPrice: 1000 };
  expect(findRelistMatch(lostSingle, [item("2", "Garmin", 950)])?.id).toBe("2");
});
