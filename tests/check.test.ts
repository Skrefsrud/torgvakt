import { readFileSync } from "node:fs";
import { applyFetchResult } from "../src/core/check";
import type { Settings, TrackedListing } from "../src/shared/types";

const activeHtml = readFileSync("tests/fixtures/listing-active.html", "utf-8");
const soldHtml = readFileSync("tests/fixtures/listing-sold.html", "utf-8");
const settings: Settings = { checkIntervalHours: 6, notifyDrops: true, notifyAll: false };

function listing(price: number): TrackedListing {
  return {
    id: "466564665", url: "https://www.finn.no/recommerce/forsale/item/466564665",
    title: "TRIACLE SYKKEL", image: "", addedAt: 1, status: "active",
    history: [{ ts: 1, price }],
  };
}

test("404 marks removed, no notification unless notifyAll", () => {
  const l = listing(500);
  expect(applyFetchResult(l, 404, null, settings, 2)).toBeNull();
  expect(l.status).toBe("removed");
  const l2 = listing(500);
  expect(applyFetchResult(l2, 404, null, { ...settings, notifyAll: true }, 2)).toContain("fjernet");
});

test("sold availability marks sold", () => {
  const l = listing(500);
  applyFetchResult(l, 200, soldHtml, settings, 2);
  expect(l.status).toBe("sold");
});

test("price drop appends history and notifies", () => {
  const l = listing(800); // fixture price is 500, so this is a drop
  const msg = applyFetchResult(l, 200, activeHtml, settings, 2);
  expect(l.history).toHaveLength(2);
  expect(msg).toBe("Pris ned: 800 kr → 500 kr");
});

test("price increase notifies only with notifyAll", () => {
  const l = listing(300);
  expect(applyFetchResult(l, 200, activeHtml, settings, 2)).toBeNull();
  expect(l.history).toHaveLength(2);
  const l2 = listing(300);
  expect(applyFetchResult(l2, 200, activeHtml, { ...settings, notifyAll: true }, 2)).toBe("Pris opp: 300 kr → 500 kr");
});

test("unchanged price does nothing", () => {
  const l = listing(500);
  expect(applyFetchResult(l, 200, activeHtml, settings, 2)).toBeNull();
  expect(l.history).toHaveLength(1);
});

test("unparseable html flags parseError without touching history", () => {
  const l = listing(500);
  applyFetchResult(l, 200, "<html>nope</html>", settings, 2);
  expect(l.status).toBe("parseError");
  expect(l.history).toHaveLength(1);
});

test("server error leaves listing untouched", () => {
  const l = listing(500);
  expect(applyFetchResult(l, 503, null, settings, 2)).toBeNull();
  expect(l.status).toBe("active");
});
