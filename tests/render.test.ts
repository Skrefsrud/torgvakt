import { renderListingItem, statusLabel } from "../src/popup/render";
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

test("escapes html in titles", () => {
  const html = renderListingItem({ ...base, title: "<img onerror=x>" });
  expect(html).not.toContain("<img onerror");
});
