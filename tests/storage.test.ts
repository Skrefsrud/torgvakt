import { getSettings, getTracked, saveSettings, trackListing, untrackListing } from "../src/shared/storage";
import type { TrackedListing } from "../src/shared/types";

const store: Record<string, unknown> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: store[key] }),
        set: async (obj: Record<string, unknown>) => Object.assign(store, obj),
      },
    },
  };
});

const listing: TrackedListing = {
  id: "1", url: "https://www.finn.no/recommerce/forsale/item/1", title: "Sykkel",
  image: "", addedAt: 1, status: "active", history: [{ ts: 1, price: 500 }],
};

test("getTracked defaults to empty map", async () => {
  expect(await getTracked()).toEqual({});
});

test("track and untrack round-trip", async () => {
  await trackListing(listing);
  expect((await getTracked())["1"].title).toBe("Sykkel");
  await untrackListing("1");
  expect(await getTracked()).toEqual({});
});

test("settings default and merge", async () => {
  expect(await getSettings()).toEqual({ checkIntervalHours: 6, notifyDrops: true, notifyAll: false });
  await saveSettings({ checkIntervalHours: 1, notifyDrops: true, notifyAll: true });
  expect((await getSettings()).checkIntervalHours).toBe(1);
});
