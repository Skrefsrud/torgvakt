import { applyCycleOps } from "../src/core/merge";
import type { TrackedListing } from "../src/shared/types";

const listing = (id: string, price = 100): TrackedListing => ({
  id, url: `https://www.finn.no/recommerce/forsale/item/${id}`, title: `Ting ${id}`,
  image: "", addedAt: 1, status: "active", history: [{ ts: 1, price }],
});

test("applies updates to listings still tracked", () => {
  const fresh = { "1": listing("1") };
  const updated = { ...listing("1"), status: "sold" as const };
  const out = applyCycleOps(fresh, { updates: [updated], rebinds: [] });
  expect(out["1"].status).toBe("sold");
});

test("does not resurrect listings the user untracked mid-cycle", () => {
  const fresh = {}; // user removed it while the cycle ran
  const out = applyCycleOps(fresh, { updates: [listing("1")], rebinds: [] });
  expect(out).toEqual({});
});

test("preserves listings the user added mid-cycle", () => {
  const fresh = { "1": listing("1"), "9": listing("9") }; // "9" added during the cycle
  const out = applyCycleOps(fresh, { updates: [{ ...listing("1"), status: "removed" as const }], rebinds: [] });
  expect(Object.keys(out).sort()).toEqual(["1", "9"]);
  expect(out["1"].status).toBe("removed");
});

test("applies rebinds, skipping ones whose source was untracked", () => {
  const fresh = { "1": listing("1") };
  const out = applyCycleOps(fresh, {
    updates: [],
    rebinds: [
      { oldId: "1", listing: { ...listing("2"), relistedFrom: ["1"] } },
      { oldId: "99", listing: listing("3") },
    ],
  });
  expect(Object.keys(out)).toEqual(["2"]);
});
