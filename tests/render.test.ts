import { renderListingItem, renderListingList, statusLabel } from "../src/popup/render";
import type { TrackedListing } from "../src/shared/types";

const base: TrackedListing = {
  id: "1", url: "https://www.finn.no/recommerce/forsale/item/1", title: "Sykkel",
  image: "https://images.finncdn.no/x.jpg", addedAt: 1, status: "active",
  history: [{ ts: 1, price: 1000 }, { ts: 2, price: 750 }],
};

test("renders title, current price, change and sparkline", () => {
  const html = renderListingItem(base);
  expect(html).toContain("Sykkel");
  expect(html).toContain("750 kr");
  expect(html).toContain("-250");
  expect(html).toContain("<path");
  expect(html).toContain('data-id="1"');
});

test("status labels", () => {
  expect(statusLabel("active")).toBe("");
  expect(statusLabel("sold")).toBe("Solgt");
  expect(statusLabel("removed")).toBe("Fjernet");
  expect(statusLabel("parseError")).toBe("Lesefeil");
});

test("shows relist badge when listing was rebound", () => {
  const html = renderListingItem({ ...base, relistedFrom: ["99"] });
  expect(html).toContain("Lagt ut på nytt");
});

test("escapes html in titles", () => {
  const html = renderListingItem({ ...base, title: "<img onerror=x>" });
  expect(html).not.toContain("<img onerror");
});

test("survives a corrupt entry with non-string image (legacy mobility bug)", () => {
  const corrupt = { ...base, image: [{ contentUrl: "https://a/b.jpg" }] as unknown as string };
  expect(() => renderListingItem(corrupt)).not.toThrow();
});

test("renderListingList isolates a throwing entry instead of blanking the list", () => {
  const broken = { ...base, id: "2", history: [] }; // no points -> renderListingItem throws
  const html = renderListingList([base, broken]);
  expect(html).toContain("Sykkel");
  expect(html).toContain("tv-broken");
});
