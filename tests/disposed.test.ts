import { readFileSync } from "node:fs";
import { parseDisposed } from "../src/core/parse";
import { applyFetchResult } from "../src/core/check";
import type { Settings, TrackedListing } from "../src/shared/types";

const disposedHtml = readFileSync("tests/fixtures/listing-disposed.html", "utf-8");
const activeHtml = readFileSync("tests/fixtures/listing-active.html", "utf-8");
const settings: Settings = { checkIntervalHours: 6, notifyDrops: true, notifyAll: false };

test("parseDisposed detects the disposed marker on a real expired page", () => {
  expect(parseDisposed(disposedHtml)).toEqual({ disposed: true, text: "Solgt" });
});

test("parseDisposed is null on a live listing", () => {
  expect(parseDisposed(activeHtml)).toBeNull();
});

test("HTTP 200 disposed page marks listing sold, not parseError", () => {
  const l: TrackedListing = {
    id: "400000000", url: "https://www.finn.no/recommerce/forsale/item/400000000",
    title: "Fred Perry harrington jakke", image: "", addedAt: 1, status: "active",
    history: [{ ts: 1, price: 200 }],
  };
  applyFetchResult(l, 200, disposedHtml, settings, 2);
  expect(l.status).toBe("sold");
  expect(l.history).toHaveLength(1);
});
